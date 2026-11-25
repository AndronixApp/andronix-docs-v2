// ChatLimiter's logic (build plan 1.4, 1.5, 1.9), kept free of Workers APIs so `node --test` can
// run it against a Map. One global Durable Object holds every counter: per-uid limits, the
// session owner map, global spend and budget, the new-uid-per-IP rule and tombstones.
// All writes go through a synchronous KV store, so each method is atomic inside the DO.

import type { ErrorCode } from "../../lib/chat-contract/http/http-errors.ts";
import type { Entry } from "../body.ts";
import type { Limits, StrikeReason, Tier } from "../env.ts";

export interface Store {
  get<T>(key: string): T | undefined;
  put<T>(key: string, value: T): void;
  delete(key: string): boolean;
  list<T>(prefix: string): Iterable<[string, T]>;
}

export class MapStore implements Store {
  m = new Map<string, unknown>();
  get<T>(k: string) { return structuredClone(this.m.get(k)) as T | undefined; }
  put<T>(k: string, v: T) { this.m.set(k, structuredClone(v)); }
  delete(k: string) { return this.m.delete(k); }
  *list<T>(prefix: string): Iterable<[string, T]> {
    for (const [k, v] of [...this.m.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) if (k.startsWith(prefix)) yield [k, structuredClone(v) as T];
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const DEDUPE_MS = 10 * MIN;
export const TURN_RUNNING_MAX_MS = 3 * MIN;
/** eve ends a stream lease after 60 s and the client reconnects, so a lease the Worker never saw close frees itself after 90 s. */
export const STREAM_LEASE_MS = 90_000;
export const SESSION_IDLE_MS = 25 * HOUR;
export const COUNTER_KEEP_MS = 35 * DAY;
export const GENERATION_KEEP_MS = 48 * HOUR;
export const TOMBSTONE_MS = HOUR;
export const ACCOUNT_CACHE_MS = HOUR;

export const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const utcMonth = (t: number) => new Date(t).toISOString().slice(0, 7);
function nextUtcMidnight(t: number) { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); }
function nextUtcMonth(t: number) { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
function daysLeftInMonth(t: number) { const d = new Date(t); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); return last - d.getUTCDate() + 1; }

interface Window { start: number; count: number }
interface UserRec {
  minute: Window;
  day: { date: string; count: number };
  month: { ym: string; count: number };
  costDay: { date: string; micros: number };
  tickets: { date: string; keys: string[] };
  streams: { id: string; exp: number; sid?: string }[];
  streamOpens: Window;
  sessions: string[];
  lastSeen: number;
}
interface SessionRec {
  uid: string; entry: Entry; turns: number; createdAt: number; lastActive: number;
  turnRunningSince: number | null; reportId: string | null; feedback: string[]; ended: boolean;
}
interface AccountRec { tier: "free" | "owner"; createdAt: number; at: number }
export type BudgetState = "normal" | "degrade" | "free_paused" | "owners_paused" | "month_stop";
interface GlobalRec {
  day: { date: string; micros: number };
  month: { ym: string; micros: number };
  floor: { ym: string; micros: number };
  state: BudgetState;
  lastUsageAt: number;
  admitsSinceUsage: number[];
  watchdog: boolean;
  /** No usage for watchdogPauseMs while watchdogPauseMessages flowed: free accounts pause (QA-1 S7). */
  watchdogPause?: boolean;
  admitCount?: number;
  firstAdmitAt?: number;
}

interface StrikeRec { events: { at: number; points: number; turnId: string }[]; cooldownUntil: number }
export type StrikeResult = { counted: boolean; points: number; total: number; cooldownUntil: number; startedMs: number; longest: boolean };
interface DedupeRec { at: number; state: "pending" | "done"; status?: number; body?: string; sessionId?: string }
export type Admitted = { ok: true; kind: "new"; budget: "normal" | "degrade"; transition: BudgetTransition | null };
export type Replay = { ok: true; kind: "replay"; status: number; body: string; sessionId?: string };

export interface Who { uid: string; tier: Tier; staff: boolean; ip: string; newAccount: boolean; issuedAt: number }
export type Deny = { ok: false; code: ErrorCode; retryAfter?: number };
export type BudgetTransition = { state: BudgetState; cause: "spend" | "watchdog" | "floor" };

const emptyUser = (now: number): UserRec => ({
  minute: { start: now, count: 0 }, day: { date: utcDay(now), count: 0 }, month: { ym: utcMonth(now), count: 0 },
  costDay: { date: utcDay(now), micros: 0 }, tickets: { date: utcDay(now), keys: [] }, streams: [],
  streamOpens: { start: now, count: 0 }, sessions: [], lastSeen: now,
});

export class LimiterCore {
  private s: Store;
  private limits: Limits;
  private now: () => number;
  constructor(s: Store, limits: Limits, now: () => number = Date.now) { this.s = s; this.limits = limits; this.now = now; }

  setLimits(l: Limits) { this.limits = l; }

  // ---- records ----
  private user(uid: string): UserRec {
    const now = this.now();
    const u = this.s.get<UserRec>(`u:${uid}`) ?? emptyUser(now);
    if (now - u.minute.start >= MIN) u.minute = { start: now, count: 0 };
    if (u.day.date !== utcDay(now)) u.day = { date: utcDay(now), count: 0 };
    if (u.month.ym !== utcMonth(now)) u.month = { ym: utcMonth(now), count: 0 };
    if (u.costDay.date !== utcDay(now)) u.costDay = { date: utcDay(now), micros: 0 };
    if (u.tickets.date !== utcDay(now)) u.tickets = { date: utcDay(now), keys: [] };
    if (now - u.streamOpens.start >= MIN) u.streamOpens = { start: now, count: 0 };
    u.streams = u.streams.filter((l) => l.exp > now);
    return u;
  }
  private saveUser(uid: string, u: UserRec) { u.lastSeen = this.now(); this.s.put(`u:${uid}`, u); }

  private global(): GlobalRec {
    const now = this.now();
    const g = this.s.get<GlobalRec>("global") ?? {
      day: { date: utcDay(now), micros: 0 }, month: { ym: utcMonth(now), micros: 0 }, floor: { ym: utcMonth(now), micros: 0 },
      state: "normal", lastUsageAt: 0, admitsSinceUsage: [], watchdog: false,
    };
    if (g.day.date !== utcDay(now)) g.day = { date: utcDay(now), micros: 0 };
    if (g.month.ym !== utcMonth(now)) { g.month = { ym: utcMonth(now), micros: 0 }; g.day = { date: utcDay(now), micros: 0 }; }
    if (g.floor.ym !== utcMonth(now)) g.floor = { ym: utcMonth(now), micros: 0 };
    return g;
  }

  // ---- auth: tombstones ----
  /** True when the uid was erased after this token was issued (1 h). */
  isTombstoned(uid: string, issuedAt: number): boolean {
    const t = this.s.get<number>(`tomb:${uid}`);
    return t !== undefined && this.now() - t < TOMBSTONE_MS && issuedAt <= t;
  }

  // ---- account cache (tier from products-api, 1 h) ----
  getAccount(uid: string): AccountRec | null {
    const a = this.s.get<AccountRec>(`acct:${uid}`);
    return a && this.now() - a.at < ACCOUNT_CACHE_MS ? a : null;
  }
  getStaleAccount(uid: string): AccountRec | null { return this.s.get<AccountRec>(`acct:${uid}`) ?? null; }
  /** ttlMs < 1 h stores a short-lived fallback (products-api down): retried after ttlMs, not on every request. */
  setAccount(uid: string, tier: "free" | "owner", createdAt: number, ttlMs = ACCOUNT_CACHE_MS) {
    this.s.put(`acct:${uid}`, { tier, createdAt, at: this.now() - (ACCOUNT_CACHE_MS - ttlMs) });
  }

  // ---- budget ----
  private effective(g: GlobalRec) {
    const month = Math.max(g.month.micros, g.floor.micros);
    const day = g.day.micros + Math.max(0, g.floor.micros - g.month.micros);
    const beforeToday = Math.max(0, month - day);
    const allowance = Math.max(0, (this.limits.monthStopMicros - beforeToday) / daysLeftInMonth(this.now()));
    return { month, day, allowance };
  }
  private computeState(g: GlobalRec): BudgetState {
    const e = this.effective(g);
    if (e.month >= this.limits.monthStopMicros) return "month_stop";
    const r = e.allowance > 0 ? e.day / e.allowance : Infinity;
    if (r >= this.limits.ownerPauseAt) return "owners_paused";
    if (r >= this.limits.freePauseAt) return "free_paused";
    if (g.watchdogPause) return "free_paused";
    if (r >= this.limits.degradeAt || g.watchdog) return "degrade";
    return "normal";
  }
  /** Recomputes the budget state; returns a transition once when it changes. */
  private settle(g: GlobalRec, cause: BudgetTransition["cause"]): BudgetTransition | null {
    const next = this.computeState(g);
    const prev = g.state;
    g.state = next;
    this.s.put("global", g);
    const byWatchdog = (g.watchdog && next === "degrade") || (!!g.watchdogPause && next === "free_paused");
    return next !== prev ? { state: next, cause: byWatchdog ? "watchdog" : cause } : null;
  }
  budgetFor(tier: Tier): { budget: "normal" | "degrade" | "paused"; retryAfter: number } {
    const g = this.global();
    const st = this.computeState(g);
    const now = this.now();
    const toMidnight = Math.ceil((nextUtcMidnight(now) - now) / 1000);
    if (st === "month_stop") return { budget: "paused", retryAfter: Math.ceil((nextUtcMonth(now) - now) / 1000) };
    if (tier === "staff") return { budget: st === "normal" ? "normal" : "degrade", retryAfter: 0 };
    if (st === "owners_paused") return { budget: "paused", retryAfter: toMidnight };
    if (st === "free_paused" && tier !== "owner") return { budget: "paused", retryAfter: toMidnight };
    return { budget: st === "normal" ? "normal" : "degrade", retryAfter: 0 };
  }

  // ---- messages ----
  private limitsFor(tier: Tier) { return this.limits.tiers[tier]; }

  private checkUserLimits(who: Who, u: UserRec): Deny | null {
    const now = this.now();
    const l = this.limitsFor(who.tier);
    if (u.minute.count >= l.minute) return { ok: false, code: "rate_minute", retryAfter: Math.ceil((u.minute.start + MIN - now) / 1000) };
    if (u.day.count >= l.day) return { ok: false, code: who.tier === "new" ? "new_account" : "rate_day", retryAfter: Math.ceil((nextUtcMidnight(now) - now) / 1000) };
    if (u.month.count >= l.month) return { ok: false, code: "rate_month", retryAfter: Math.ceil((nextUtcMonth(now) - now) / 1000) };
    if (u.costDay.micros >= l.costDayMicros) return { ok: false, code: "cost_day", retryAfter: Math.ceil((nextUtcMidnight(now) - now) / 1000) };
    return null;
  }

  /** New-uid-per-IP rule: young uids first seen from one IP per day. Records the uid when allowed. */
  private checkNewIp(who: Who): Deny | null {
    if (!who.newAccount || who.tier === "staff" || !who.ip) return null;
    const key = `ip:${utcDay(this.now())}:${who.ip}`;
    const set = this.s.get<string[]>(key) ?? [];
    if (set.includes(who.uid)) return null;
    if (set.length >= this.limits.newUidsPerIpPerDay) {
      return { ok: false, code: "new_ip", retryAfter: Math.ceil((nextUtcMidnight(this.now()) - this.now()) / 1000) };
    }
    set.push(who.uid);
    this.s.put(key, set);
    return null;
  }

  // ---- clientMsgId de-dupe (QA-1 B1) ----
  // Scoped to (uid, "create" | sessionId, clientMsgId). A repeat never reaches eve and never
  // starts a turn: it gets the original response once eve has answered, or 409 turn_running
  // while the original is still in flight. The same id on another session is a new message and
  // goes through every limit like any other.
  private dedupeKey(uid: string, scope: string, clientMsgId: string) { return `dd:${uid}:${scope}:${clientMsgId}`; }
  private dedupe(uid: string, scope: string, clientMsgId: string | undefined): DedupeRec | null {
    if (!clientMsgId) return null;
    const r = this.s.get<DedupeRec>(this.dedupeKey(uid, scope, clientMsgId));
    return r && this.now() - r.at < DEDUPE_MS ? r : null;
  }
  private replay(r: DedupeRec): Deny | Replay {
    if (r.state === "pending" || r.status === undefined) return { ok: false, code: "turn_running", retryAfter: 5 };
    return { ok: true, kind: "replay", status: r.status, body: r.body ?? "", sessionId: r.sessionId };
  }
  /** eve accepted the message: later repeats get this response. */
  recordResult(uid: string, scope: string, clientMsgId: string, status: number, body: string, sessionId?: string) {
    const k = this.dedupeKey(uid, scope, clientMsgId);
    const r = this.s.get<DedupeRec>(k);
    if (!r) return;
    this.s.put<DedupeRec>(k, { ...r, state: "done", status, body: body.slice(0, 2048), sessionId });
  }
  /** eve refused or failed: a retry with the same id is admitted (and counted) as a new message. */
  releaseDedupe(uid: string, scope: string, clientMsgId: string) { this.s.delete(this.dedupeKey(uid, scope, clientMsgId)); }

  private admitCommon(who: Who, scope: string, clientMsgId: string | undefined): Deny | Admitted {
    const cool = this.cooldownLeft(who);
    if (cool > 0) return { ok: false, code: "cooldown", retryAfter: Math.ceil(cool / 1000) };
    const b = this.budgetFor(who.tier);
    if (b.budget === "paused") return { ok: false, code: "budget_paused", retryAfter: b.retryAfter };
    const u = this.user(who.uid);
    const deny = this.checkUserLimits(who, u) ?? this.checkNewIp(who);
    if (deny) return deny;
    u.minute.count++; u.day.count++; u.month.count++;
    this.saveUser(who.uid, u);
    if (clientMsgId) this.s.put<DedupeRec>(this.dedupeKey(who.uid, scope, clientMsgId), { at: this.now(), state: "pending" });
    // watchdog: messages flow but no usage arrives
    const g = this.global();
    const now = this.now();
    g.admitsSinceUsage = [...g.admitsSinceUsage, now].slice(-200);
    if (!g.watchdog && g.admitsSinceUsage.length >= this.limits.watchdogMessages && now - g.admitsSinceUsage[0] >= this.limits.watchdogWindowMs && now - g.lastUsageAt >= this.limits.watchdogWindowMs) {
      g.watchdog = true;
    }
    // Usage that never arrives (a wrong secret, a WAF rule) would otherwise keep tracked spend at 0
    // forever; after watchdogPauseMs with enough traffic, free accounts pause until usage returns.
    g.admitCount = (g.admitCount ?? 0) + 1;
    g.firstAdmitAt ??= now;
    if (!g.watchdogPause && g.admitCount >= this.limits.watchdogPauseMessages && now - Math.max(g.lastUsageAt, g.firstAdmitAt) >= this.limits.watchdogPauseMs) {
      g.watchdogPause = true;
    }
    const transition = this.settle(g, "watchdog");
    // this message is already admitted; a pause applies from the next one
    const after = this.budgetFor(who.tier);
    return { ok: true, kind: "new", budget: after.budget === "paused" ? "degrade" : after.budget, transition };
  }

  /** Session create: counts 1 message and turn 1. Session binding comes after eve answers. */
  admitCreate(who: Who, clientMsgId?: string): Deny | Admitted | Replay {
    const r = this.dedupe(who.uid, "create", clientMsgId);
    if (r) return this.replay(r);
    return this.admitCommon(who, "create", clientMsgId);
  }

  /** Binds a new session to its owner. Never resets a session that already exists. */
  bindSession(uid: string, sessionId: string, entry: Entry): void {
    const now = this.now();
    if (this.s.get<SessionRec>(`s:${sessionId}`)) return;
    this.s.put<SessionRec>(`s:${sessionId}`, { uid, entry, turns: 1, createdAt: now, lastActive: now, turnRunningSince: now, reportId: null, feedback: [], ended: false });
    const u = this.user(uid);
    u.sessions = [...u.sessions.filter((x) => x !== sessionId), sessionId].slice(-200);
    this.saveUser(uid, u);
  }

  /** Owner check for every route that takes a sessionId. */
  session(uid: string, sessionId: string): { ok: true; entry: Entry; turns: number; reportId: string | null } | Deny {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s || s.uid !== uid) return { ok: false, code: "not_owner" };
    return { ok: true, entry: s.entry, turns: s.turns, reportId: s.reportId };
  }

  /** Follow-up: owner check, then a repeat of this session's id replays; else 12 turns, one in flight, every limit. */
  admitFollowup(who: Who, sessionId: string, clientMsgId?: string): Deny | Replay | (Admitted & { entry: Entry; turn: number }) {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s || s.uid !== who.uid) return { ok: false, code: "not_owner" };
    const now = this.now();
    const d = this.dedupe(who.uid, sessionId, clientMsgId);
    if (d) return this.replay(d);
    const cool = this.cooldownLeft(who);
    if (cool > 0) return { ok: false, code: "cooldown", retryAfter: Math.ceil(cool / 1000) };
    if (s.ended || s.turns >= this.limits.turnsPerChat) return { ok: false, code: "chat_full" };
    if (s.turnRunningSince !== null && now - s.turnRunningSince < TURN_RUNNING_MAX_MS) return { ok: false, code: "turn_running", retryAfter: 5 };
    const r = this.admitCommon(who, sessionId, clientMsgId);
    if (!r.ok) return r;
    s.turns += 1; s.lastActive = now; s.turnRunningSince = now;
    this.s.put(`s:${sessionId}`, s);
    return { ...r, entry: s.entry, turn: s.turns };
  }

  /** The Worker saw the turn end on the stream, or a cancel went through. */
  turnEnded(sessionId: string, sessionEnded = false) {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s) return;
    s.turnRunningSince = null; s.lastActive = this.now();
    if (sessionEnded) s.ended = true;
    this.s.put(`s:${sessionId}`, s);
  }

  /** Undo the turn mark when eve refused the message (no turn started). The message stays counted. */
  turnRejected(sessionId: string) { this.turnEnded(sessionId); }

  // ---- streams ----
  openStream(uid: string, sessionId: string): Deny | { ok: true; leaseId: string } {
    const s = this.session(uid, sessionId);
    if (!s.ok) return s;
    const u = this.user(uid);
    const now = this.now();
    if (u.streamOpens.count >= this.limits.streamOpensPerMinute) return { ok: false, code: "streams", retryAfter: Math.ceil((u.streamOpens.start + MIN - now) / 1000) };
    // A client follows a session with one stream at a time; a new open on the same session means
    // the old one was abandoned (a disconnect the Worker may not see), so it replaces that lease.
    // The 3-concurrent cap counts sessions; 30 opens a minute bounds re-opens.
    u.streams = u.streams.filter((l) => l.sid !== sessionId);
    if (u.streams.length >= this.limits.streamsConcurrent) return { ok: false, code: "streams", retryAfter: 10 };
    const leaseId = crypto.randomUUID();
    u.streams.push({ id: leaseId, exp: now + STREAM_LEASE_MS, sid: sessionId });
    u.streamOpens.count++;
    this.saveUser(uid, u);
    return { ok: true, leaseId };
  }
  closeStream(uid: string, leaseId: string) {
    const u = this.s.get<UserRec>(`u:${uid}`);
    if (!u) return;
    u.streams = u.streams.filter((l) => l.id !== leaseId);
    this.s.put(`u:${uid}`, u);
  }

  // ---- tickets, feedback, reports ----
  admitTicket(uid: string, key: string): Deny | { ok: true; repeat: boolean } {
    const u = this.user(uid);
    if (u.tickets.keys.includes(key)) return { ok: true, repeat: true };
    if (u.tickets.keys.length >= this.limits.ticketsPerDay) return { ok: false, code: "tickets", retryAfter: Math.ceil((nextUtcMidnight(this.now()) - this.now()) / 1000) };
    u.tickets.keys.push(key);
    this.saveUser(uid, u);
    return { ok: true, repeat: false };
  }
  /** Gives back a ticket slot when the desk call failed. */
  releaseTicket(uid: string, key: string) {
    const u = this.user(uid);
    u.tickets.keys = u.tickets.keys.filter((k) => k !== key);
    this.saveUser(uid, u);
  }
  /** One feedback per turn; returns false for a repeat. */
  feedback(uid: string, sessionId: string, turnId: string): Deny | { ok: true; first: boolean; turns: number } {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s || s.uid !== uid) return { ok: false, code: "not_owner" };
    if (s.feedback.includes(turnId)) return { ok: true, first: false, turns: s.turns };
    s.feedback = [...s.feedback, turnId].slice(-50);
    this.s.put(`s:${sessionId}`, s);
    return { ok: true, first: true, turns: s.turns };
  }
  bindReport(uid: string, sessionId: string, reportId: string): Deny | { ok: true } {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s || s.uid !== uid) return { ok: false, code: "not_owner" };
    s.reportId = reportId;
    this.s.put(`s:${sessionId}`, s);
    return { ok: true };
  }
  boundReport(uid: string, sessionId: string): string | null {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    return s && s.uid === uid ? s.reportId : null;
  }

  // ---- redeem (per IP) ----
  admitRedeem(ip: string): Deny | { ok: true } {
    const now = this.now();
    const key = `rip:${ip}`;
    let w = this.s.get<Window>(key) ?? { start: now, count: 0 };
    if (now - w.start >= MIN) w = { start: now, count: 0 };
    if (w.count >= this.limits.redeemPerIpPerMinute) return { ok: false, code: "ip", retryAfter: Math.ceil((w.start + MIN - now) / 1000) };
    w.count++;
    this.s.put(key, w);
    return { ok: true };
  }

  // ---- usage, budget floor ----
  usage(u: { generationId: string; uid: string; costMicros: number }): { counted: boolean; transition: BudgetTransition | null } {
    const now = this.now();
    const g = this.global();
    g.lastUsageAt = now;
    g.admitsSinceUsage = [];
    const wasWatchdog = g.watchdog || !!g.watchdogPause;
    g.watchdog = false;
    g.watchdogPause = false;
    g.admitCount = 0;
    g.firstAdmitAt = undefined;
    if (this.s.get<number>(`gen:${u.generationId}`) !== undefined) {
      return { counted: false, transition: wasWatchdog ? this.settle(g, "spend") : (this.s.put("global", g), null) };
    }
    this.s.put(`gen:${u.generationId}`, now);
    const cost = Math.max(0, Math.round(u.costMicros));
    g.day.micros += cost;
    g.month.micros += cost;
    const user = this.user(u.uid);
    user.costDay.micros += cost;
    this.saveUser(u.uid, user);
    return { counted: true, transition: this.settle(g, "spend") };
  }

  setFloor(monthSpendMicrosFloor: number): BudgetTransition | null {
    const g = this.global();
    g.floor = { ym: utcMonth(this.now()), micros: Math.max(g.floor.micros, Math.max(0, Math.round(monthSpendMicrosFloor))) };
    return this.settle(g, "floor");
  }

  budgetReport() {
    const g = this.global();
    const e = this.effective(g);
    const st = this.computeState(g);
    return {
      budget: st === "normal" ? "normal" : st === "degrade" ? "degrade" : "paused",
      state: st,
      daySpendMicros: e.day,
      monthSpendMicros: e.month,
      allowanceMicros: Math.floor(e.allowance),
      lastUsageAt: g.lastUsageAt ? new Date(g.lastUsageAt).toISOString() : null,
    };
  }

  // ---- /chat-api/me ----
  me(who: Who) {
    const u = this.user(who.uid);
    const l = this.limitsFor(who.tier);
    const now = this.now();
    return {
      minute: { used: u.minute.count, max: l.minute, resetAt: new Date(u.minute.start + MIN).toISOString() },
      day: { used: u.day.count, max: l.day, resetAt: new Date(nextUtcMidnight(now)).toISOString() },
      month: { used: u.month.count, max: l.month, resetAt: new Date(nextUtcMonth(now)).toISOString() },
      costDay: { usedMicros: u.costDay.micros, maxMicros: l.costDayMicros },
      budget: this.budgetFor(who.tier).budget,
      cooldownUntil: this.cooldownLeft(who) > 0 ? new Date(now + this.cooldownLeft(who)).toISOString() : null,
    };
  }

  // ---- strikes and cooldown (guardrails §2) ----
  /** ms of cooldown left for this caller; staff are exempt. */
  cooldownLeft(who: Pick<Who, "uid" | "tier">): number {
    if (who.tier === "staff") return 0;
    const r = this.s.get<StrikeRec>(`strk:${who.uid}`);
    return r ? Math.max(0, r.cooldownUntil - this.now()) : 0;
  }

  /**
   * eve reports a refused turn. De-duplicated on turnId; weights and steps from LIMITS_JSON.abuse.
   * Crossing a step (3 / 6 / 10 points in 24 h) starts its cooldown (10 min / 1 h / 24 h).
   */
  strike(uid: string, sessionId: string, turnId: string, reason: StrikeReason): StrikeResult | Deny {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (s && s.uid !== uid) return { ok: false, code: "not_owner" };
    const a = this.limits.abuse;
    const now = this.now();
    const key = `strk:${uid}`;
    const r = this.s.get<StrikeRec>(key) ?? { events: [], cooldownUntil: 0 };
    r.events = r.events.filter((e) => now - e.at < a.windowMs);
    const before = r.events.reduce((n, e) => n + e.points, 0);
    if (r.events.some((e) => e.turnId === turnId)) {
      return { counted: false, points: 0, total: before, cooldownUntil: r.cooldownUntil, startedMs: 0, longest: false };
    }
    const points = a.weights[reason] ?? 1;
    r.events.push({ at: now, points, turnId });
    const total = before + points;
    const stepOf = (n: number) => a.steps.filter((st) => n >= st.points).length; // 0 = none
    const was = stepOf(before);
    const step = stepOf(total);
    let startedMs = 0;
    if (step > was) {
      startedMs = a.steps[step - 1].ms;
      r.cooldownUntil = Math.max(r.cooldownUntil, now + startedMs);
    }
    this.s.put(key, r);
    return { counted: true, points, total, cooldownUntil: r.cooldownUntil, startedMs, longest: step > was && step === a.steps.length };
  }

  // ---- erase ----
  /** The uid's sessions (newest last, ≤200), for eve's erase call before the DO forgets them. */
  sessionsOf(uid: string): string[] {
    return this.s.get<UserRec>(`u:${uid}`)?.sessions ?? [];
  }
  /** Refuses tokens issued before now for 1 h, before eve confirms the erase. */
  tombstone(uid: string) { this.s.put(`tomb:${uid}`, this.now()); }

  /** Deletes the uid's counters, sessions and bindings; returns the sessions to end at eve. */
  erase(uid: string): string[] {
    const u = this.s.get<UserRec>(`u:${uid}`);
    const sessions = u?.sessions ?? [];
    for (const id of sessions) this.s.delete(`s:${id}`);
    this.s.delete(`u:${uid}`);
    this.s.delete(`acct:${uid}`);
    this.s.delete(`strk:${uid}`);
    for (const [k] of this.s.list(`dd:${uid}:`)) this.s.delete(k);
    for (const [k, set] of this.s.list<string[]>("ip:")) if (set.includes(uid)) this.s.put(k, set.filter((x) => x !== uid));
    this.s.put(`tomb:${uid}`, this.now());
    return sessions;
  }

  // ---- daily alarm ----
  sweep(): { sessions: number; users: number; generations: number; tombstones: number; other: number } {
    const now = this.now();
    const out = { sessions: 0, users: 0, generations: 0, tombstones: 0, other: 0 };
    for (const [k, s] of this.s.list<SessionRec>("s:")) if (now - s.lastActive > SESSION_IDLE_MS) { this.s.delete(k); out.sessions++; }
    for (const [k, u] of this.s.list<UserRec>("u:")) if (now - u.lastSeen > COUNTER_KEEP_MS) { this.s.delete(k); out.users++; }
    for (const [k, at] of this.s.list<number>("gen:")) if (now - at > GENERATION_KEEP_MS) { this.s.delete(k); out.generations++; }
    for (const [k, at] of this.s.list<number>("tomb:")) if (now - at > TOMBSTONE_MS) { this.s.delete(k); out.tombstones++; }
    for (const [k, r] of this.s.list<DedupeRec | number>("dd:")) if (now - (typeof r === "number" ? r : r.at) > DEDUPE_MS) { this.s.delete(k); out.other++; }
    for (const [k, a] of this.s.list<AccountRec>("acct:")) if (now - a.at > COUNTER_KEEP_MS) { this.s.delete(k); out.other++; }
    for (const [k, r] of this.s.list<StrikeRec>("strk:")) {
      if (r.cooldownUntil <= now && r.events.every((e) => now - e.at >= this.limits.abuse.windowMs)) { this.s.delete(k); out.other++; }
    }
    const today = utcDay(now);
    for (const [k] of this.s.list("ip:")) if (k.slice(3, 13) !== today) { this.s.delete(k); out.other++; }
    for (const [k, w] of this.s.list<Window>("rip:")) if (now - w.start > MIN) { this.s.delete(k); out.other++; }
    return out;
  }
}
