// ChatLimiter's logic (build plan 1.4, 1.5, 1.9), kept free of Workers APIs so `node --test` can
// run it against a Map. One global Durable Object holds every counter: per-uid limits, the
// session owner map, global spend and budget, the new-uid-per-IP rule and tombstones.
// All writes go through a synchronous KV store, so each method is atomic inside the DO.

import type { ErrorCode } from "../../lib/chat-contract/http/http-errors.ts";
import type { Entry } from "../body.ts";
import type { Limits, Tier } from "../env.ts";

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
  streams: { id: string; exp: number }[];
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
}

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
  setAccount(uid: string, tier: "free" | "owner", createdAt: number) { this.s.put(`acct:${uid}`, { tier, createdAt, at: this.now() }); }

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
    if (r >= this.limits.degradeAt || g.watchdog) return "degrade";
    return "normal";
  }
  /** Recomputes the budget state; returns a transition once when it changes. */
  private settle(g: GlobalRec, cause: BudgetTransition["cause"]): BudgetTransition | null {
    const next = this.computeState(g);
    const prev = g.state;
    g.state = next;
    this.s.put("global", g);
    return next !== prev ? { state: next, cause: g.watchdog && next === "degrade" ? "watchdog" : cause } : null;
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

  private dedupeKey(uid: string, clientMsgId: string) { return `dd:${uid}:${clientMsgId}`; }
  private seen(uid: string, clientMsgId: string | undefined) {
    if (!clientMsgId) return false;
    const at = this.s.get<number>(this.dedupeKey(uid, clientMsgId));
    return at !== undefined && this.now() - at < DEDUPE_MS;
  }

  private admitCommon(who: Who, clientMsgId: string | undefined): Deny | { ok: true; duplicate: boolean; budget: "normal" | "degrade"; transition: BudgetTransition | null; turn?: number } {
    if (this.seen(who.uid, clientMsgId)) {
      const b = this.budgetFor(who.tier);
      return { ok: true, duplicate: true, budget: b.budget === "paused" ? "degrade" : b.budget, transition: null };
    }
    const b = this.budgetFor(who.tier);
    if (b.budget === "paused") return { ok: false, code: "budget_paused", retryAfter: b.retryAfter };
    const u = this.user(who.uid);
    const deny = this.checkUserLimits(who, u) ?? this.checkNewIp(who);
    if (deny) return deny;
    u.minute.count++; u.day.count++; u.month.count++;
    this.saveUser(who.uid, u);
    if (clientMsgId) this.s.put(this.dedupeKey(who.uid, clientMsgId), this.now());
    // watchdog: messages flow but no usage arrives
    const g = this.global();
    const now = this.now();
    g.admitsSinceUsage = [...g.admitsSinceUsage, now].slice(-200);
    if (!g.watchdog && g.admitsSinceUsage.length >= this.limits.watchdogMessages && now - g.admitsSinceUsage[0] >= this.limits.watchdogWindowMs && now - g.lastUsageAt >= this.limits.watchdogWindowMs) {
      g.watchdog = true;
    }
    const transition = this.settle(g, "watchdog");
    const after = this.budgetFor(who.tier);
    return { ok: true, duplicate: false, budget: after.budget === "paused" ? "degrade" : after.budget, transition };
  }

  /** Session create: counts 1 message and turn 1. Session binding comes after eve answers. */
  admitCreate(who: Who, clientMsgId?: string) {
    return this.admitCommon(who, clientMsgId);
  }

  bindSession(uid: string, sessionId: string, entry: Entry): void {
    const now = this.now();
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

  /** Follow-up: owner check, 12-turn cap, one turn in flight, then the message limits. */
  admitFollowup(who: Who, sessionId: string, clientMsgId?: string): Deny | { ok: true; duplicate: boolean; budget: "normal" | "degrade"; entry: Entry; turn: number; transition: BudgetTransition | null } {
    const s = this.s.get<SessionRec>(`s:${sessionId}`);
    if (!s || s.uid !== who.uid) return { ok: false, code: "not_owner" };
    const now = this.now();
    if (this.seen(who.uid, clientMsgId)) {
      const r = this.admitCommon(who, clientMsgId) as { ok: true; duplicate: boolean; budget: "normal" | "degrade"; transition: null };
      return { ...r, entry: s.entry, turn: s.turns };
    }
    if (s.ended || s.turns >= this.limits.turnsPerChat) return { ok: false, code: "chat_full" };
    if (s.turnRunningSince !== null && now - s.turnRunningSince < TURN_RUNNING_MAX_MS) return { ok: false, code: "turn_running", retryAfter: 5 };
    const r = this.admitCommon(who, clientMsgId);
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
    if (u.streams.length >= this.limits.streamsConcurrent) return { ok: false, code: "streams", retryAfter: 10 };
    const leaseId = crypto.randomUUID();
    u.streams.push({ id: leaseId, exp: now + STREAM_LEASE_MS });
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
    const wasWatchdog = g.watchdog;
    g.watchdog = false;
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
    };
  }

  // ---- erase ----
  /** Deletes the uid's counters, sessions and bindings; returns the sessions to end at eve. */
  erase(uid: string): string[] {
    const u = this.s.get<UserRec>(`u:${uid}`);
    const sessions = u?.sessions ?? [];
    for (const id of sessions) this.s.delete(`s:${id}`);
    this.s.delete(`u:${uid}`);
    this.s.delete(`acct:${uid}`);
    for (const [k] of this.s.list(`dd:${uid}:`)) this.s.delete(k);
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
    for (const [k, at] of this.s.list<number>("dd:")) if (now - at > DEDUPE_MS) { this.s.delete(k); out.other++; }
    for (const [k, a] of this.s.list<AccountRec>("acct:")) if (now - a.at > COUNTER_KEEP_MS) { this.s.delete(k); out.other++; }
    const today = utcDay(now);
    for (const [k] of this.s.list("ip:")) if (k.slice(3, 13) !== today) { this.s.delete(k); out.other++; }
    for (const [k, w] of this.s.list<Window>("rip:")) if (now - w.start > MIN) { this.s.delete(k); out.other++; }
    return out;
  }
}
