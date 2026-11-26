import { test } from "node:test";
import assert from "node:assert/strict";
import { LimiterCore, MapStore, type Who } from "./core.ts";
import { DEFAULT_LIMITS } from "../env.ts";

// 2026-11-10 12:00 UTC: 21 days left in the month including today
const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);
const MIN = 60_000;

function setup(now = T0) {
  const clock = { now };
  const store = new MapStore();
  const core = new LimiterCore(store, DEFAULT_LIMITS, () => clock.now);
  return { core, clock, store };
}
const who = (over: Partial<Who> = {}): Who => ({ uid: "u1", tier: "free", staff: false, ip: "1.1.1.1", newAccount: false, issuedAt: T0 - MIN, ...over });
const ok = <T extends { ok: boolean }>(r: T) => { assert.equal(r.ok, true, JSON.stringify(r)); return r as Extract<T, { ok: true }>; };
const code = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

/** Sends n messages spread over minutes so the per-minute limit doesn't bite. */
function sendSpread(core: LimiterCore, clock: { now: number }, w: Who, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) { clock.now += MIN; out.push(code(core.admitCreate(w, crypto.randomUUID())) as string); }
  return out;
}

test("free: 10/day, then rate_day with retryAfter", () => {
  const { core, clock } = setup();
  const r = sendSpread(core, clock, who(), 11);
  assert.deepEqual(r.slice(0, 10), Array(10).fill("ok"));
  const last = core.admitCreate(who(), crypto.randomUUID());
  assert.equal(code(last), "rate_day");
  assert.ok(!last.ok && last.retryAfter! > 0);
});

test("rate_minute: 4th message in a minute", () => {
  const { core } = setup();
  for (let i = 0; i < 3; i++) ok(core.admitCreate(who(), crypto.randomUUID()));
  assert.equal(code(core.admitCreate(who(), crypto.randomUUID())), "rate_minute");
});

test("new/unverified: 3/day → new_account; owner 30; staff 200", () => {
  const { core, clock } = setup();
  assert.deepEqual(sendSpread(core, clock, who({ uid: "n", tier: "new", newAccount: true }), 4), ["ok", "ok", "ok", "new_account"]);
  const owner = sendSpread(core, clock, who({ uid: "o", tier: "owner" }), 31);
  assert.equal(owner.filter((x) => x === "ok").length, 30);
  assert.equal(owner[30], "rate_day");
  const staff = sendSpread(core, clock, who({ uid: "s", tier: "staff", staff: true }), 201);
  assert.equal(staff.filter((x) => x === "ok").length, 200);
});

test("verify upgrades the tier immediately: unverified 3 then free up to 10", () => {
  const { core, clock } = setup();
  sendSpread(core, clock, who({ tier: "new", newAccount: true }), 3);
  assert.equal(code(core.admitCreate(who({ tier: "new", newAccount: true }), crypto.randomUUID())), "new_account");
  const after = sendSpread(core, clock, who({ tier: "free" }), 8);
  assert.deepEqual(after, [...Array(7).fill("ok"), "rate_day"]);
});

test("create: same clientMsgId twice → 409 while in flight, then the original response; counted once", () => {
  const { core } = setup();
  const id = crypto.randomUUID();
  assert.equal(ok(core.admitCreate(who(), id)).kind, "new");
  assert.equal(code(core.admitCreate(who(), id)), "turn_running", "original still in flight");
  core.bindSession("u1", "S1", "docs");
  core.recordResult("u1", "create", id, 202, '{"ok":true,"sessionId":"S1"}', "S1");
  const r = ok(core.admitCreate(who(), id));
  assert.equal(r.kind, "replay");
  assert.equal(r.sessionId, "S1");
  assert.equal(core.me(who()).day.used, 1);
});

test("create replay never re-binds: the session keeps its turns, report and feedback", () => {
  const { core, clock } = setup();
  const w = who({ tier: "staff", staff: true });
  ok(core.admitCreate(w));
  core.bindSession("u1", "S1", "docs");
  core.turnEnded("S1"); clock.now += MIN;
  ok(core.admitFollowup(w, "S1", crypto.randomUUID()));
  ok(core.bindReport("u1", "S1", "AX-FAKE01"));
  ok(core.feedback("u1", "S1", "turn_0"));
  core.bindSession("u1", "S1", "docs"); // a second bind (old replay path) must change nothing
  const s = ok(core.session("u1", "S1"));
  assert.equal(s.turns, 2);
  assert.equal(s.reportId, "AX-FAKE01");
  assert.equal(ok(core.feedback("u1", "S1", "turn_0")).first, false);
});

test("QA-1 B1 repro: an id used on S2 and sent to S1 is a new message and hits every limit", () => {
  const { core, clock } = setup();
  const w = who({ tier: "new", newAccount: true }); // 3/day, like the live account
  ok(core.admitCreate(w)); core.bindSession("u1", "S1", "docs"); core.turnEnded("S1");
  clock.now += MIN;
  ok(core.admitCreate(w)); core.bindSession("u1", "S2", "docs"); core.turnEnded("S2");
  clock.now += MIN;
  const x = crypto.randomUUID();
  const r = ok(core.admitFollowup(w, "S2", x)); // 3/3 used
  assert.equal(r.kind, "new");
  core.recordResult("u1", "S2", x, 202, "{}", "S2"); core.turnEnded("S2");
  clock.now += MIN;
  assert.equal(code(core.admitFollowup(w, "S1", crypto.randomUUID())), "new_account", "a fresh id is refused");
  assert.equal(code(core.admitFollowup(w, "S1", x)), "new_account", "S2's id on S1 is refused too");
  assert.equal(code(core.admitCreate(w, x)), "new_account", "and on a new session");
  assert.equal(core.me(w).day.used, 3);
  assert.equal(ok(core.session("u1", "S1")).turns, 1, "no turn started on S1");
  // the same id on its own session replays, never a new turn
  assert.equal(ok(core.admitFollowup(w, "S2", x)).kind, "replay");
});

test("a repeat replays even when paused, full or limited, and never passes a pause as new work", () => {
  const { core, clock } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs"); core.turnEnded("S1");
  clock.now += MIN;
  const x = crypto.randomUUID();
  ok(core.admitFollowup(who(), "S1", x));
  core.recordResult("u1", "S1", x, 202, "{}", "S1"); core.turnEnded("S1");
  core.setFloor(180_000_000); // month stop
  assert.equal(ok(core.admitFollowup(who(), "S1", x)).kind, "replay", "replay costs nothing");
  assert.equal(code(core.admitFollowup(who(), "S1", crypto.randomUUID())), "budget_paused");
});

test("eve refused the message: the id is released, a retry is admitted (and counted) as new", () => {
  const { core, clock } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs"); core.turnEnded("S1");
  clock.now += MIN;
  const x = crypto.randomUUID();
  ok(core.admitFollowup(who(), "S1", x));
  core.turnRejected("S1"); core.releaseDedupe("u1", "S1", x);
  assert.equal(ok(core.admitFollowup(who(), "S1", x)).kind, "new");
  assert.equal(core.me(who()).day.used, 3);
});

test("follow-ups: owner check, turn_running, 13th turn → chat_full", () => {
  const { core, clock } = setup();
  const w = who({ tier: "staff", staff: true });
  ok(core.admitCreate(w));
  core.bindSession("u1", "S1", "docs");
  assert.equal(code(core.admitFollowup(w, "S1", crypto.randomUUID())), "turn_running");
  assert.equal(code(core.admitFollowup(who({ uid: "u2" }), "S1")), "not_owner");
  for (let turn = 2; turn <= 12; turn++) {
    core.turnEnded("S1");
    clock.now += MIN;
    const r = ok(core.admitFollowup(w, "S1", crypto.randomUUID()));
    assert.equal(r.turn, turn);
  }
  core.turnEnded("S1");
  assert.equal(code(core.admitFollowup(w, "S1", crypto.randomUUID())), "chat_full");
});

test("turn_running expires after 3 minutes without a turn end", () => {
  const { core, clock } = setup();
  ok(core.admitCreate(who()));
  core.bindSession("u1", "S1", "docs");
  clock.now += 3 * MIN + 1;
  ok(core.admitFollowup(who(), "S1"));
});

test("new_ip: 31st young uid from one IP refused; 20 normal accounts from one IP chat freely", () => {
  const { core } = setup();
  for (let i = 0; i < 30; i++) ok(core.admitCreate(who({ uid: `young${i}`, tier: "new", newAccount: true })));
  assert.equal(code(core.admitCreate(who({ uid: "young30", tier: "new", newAccount: true }))), "new_ip");
  ok(core.admitCreate(who({ uid: "young5", tier: "new", newAccount: true }))); // already seen today
  for (let i = 0; i < 20; i++) ok(core.admitCreate(who({ uid: `old${i}`, ip: "2.2.2.2" })));
});

test("streams: 4th concurrent session → streams; same-session reopen replaces; closing frees; 31st open/min → streams", () => {
  const { core, clock } = setup();
  for (const s of ["S1", "S2", "S3", "S4"]) { ok(core.admitCreate(who({ tier: "staff", staff: true }))); core.bindSession("u1", s, "docs"); }
  const leases = ["S1", "S2", "S3"].map((s) => ok(core.openStream("u1", s)).leaseId);
  assert.equal(code(core.openStream("u1", "S4")), "streams");
  ok(core.openStream("u1", "S1")); // replaces S1's lease
  assert.equal(code(core.openStream("u1", "S4")), "streams");
  core.closeStream("u1", leases[1]);
  const l = ok(core.openStream("u1", "S4")).leaseId;
  for (const x of [l, leases[2]]) core.closeStream("u1", x);
  clock.now += 2 * 60_000;
  clock.now += MIN;
  for (let i = 0; i < 30; i++) { const x = ok(core.openStream("u1", "S1")).leaseId; core.closeStream("u1", x); }
  assert.equal(code(core.openStream("u1", "S1")), "streams");
  assert.equal(code(core.openStream("u2", "S1")), "not_owner");
});

test("tickets: 3/day, the same key repeats without counting", () => {
  const { core } = setup();
  ok(core.admitTicket("u1", "u1:S1:money"));
  assert.equal(ok(core.admitTicket("u1", "u1:S1:money")).repeat, true);
  ok(core.admitTicket("u1", "u1:2026-11-10:stuck"));
  ok(core.admitTicket("u1", "u1:S2:money"));
  assert.equal(code(core.admitTicket("u1", "u1:S3:money")), "tickets");
});

test("feedback: one per turn, second ignored; other uid → not_owner", () => {
  const { core } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  assert.equal(ok(core.feedback("u1", "S1", "t1")).first, true);
  assert.equal(ok(core.feedback("u1", "S1", "t1")).first, false);
  assert.equal(code(core.feedback("u2", "S1", "t1")), "not_owner");
});

test("budget: 41% → degrade, 86% → free paused (owners not), 100% → owners paused, staff fine until month stop", () => {
  const { core } = setup();
  // allowance today = 180 $ / 21 days ≈ 8.571 $
  const allowance = 180_000_000 / 21;
  let gen = 0;
  const spend = (fraction: number) => core.usage({ generationId: `g${gen++}`, uid: "spender", costMicros: Math.ceil(allowance * fraction) });
  assert.equal(spend(0.41).transition?.state, "degrade");
  assert.equal(core.budgetFor("free").budget, "degrade");
  assert.equal(spend(0.45).transition?.state, "free_paused");
  assert.equal(core.budgetFor("free").budget, "paused");
  assert.equal(core.budgetFor("new").budget, "paused");
  assert.equal(core.budgetFor("owner").budget, "degrade");
  assert.equal(code(core.admitCreate(who())), "budget_paused");
  assert.equal(spend(0.15).transition?.state, "owners_paused");
  assert.equal(core.budgetFor("owner").budget, "paused");
  assert.equal(core.budgetFor("staff").budget, "degrade");
  assert.equal(spend(0.01).transition, null, "one transition per state");
});

test("month stop: staff paused at $180 (via floor)", () => {
  const { core } = setup();
  assert.equal(core.setFloor(180_000_000)?.state, "month_stop");
  assert.equal(core.budgetFor("staff").budget, "paused");
  assert.equal(code(core.admitCreate(who({ tier: "staff", staff: true }))), "budget_paused");
});

test("floor POST raises month and day spend", () => {
  const { core } = setup();
  core.usage({ generationId: "g1", uid: "x", costMicros: 1_000_000 });
  core.setFloor(5_000_000);
  const r = core.budgetReport();
  assert.equal(r.monthSpendMicros, 5_000_000);
  assert.equal(r.daySpendMicros, 5_000_000); // tracked today 1 + (floor 5 − tracked month 1)
  core.setFloor(2_000_000); // a lower floor never lowers it
  assert.equal(core.budgetReport().monthSpendMicros, 5_000_000);
});

test("floor: an over-count is corrected down to the billed value only once usage has settled", () => {
  const { core, clock } = setup();
  core.usage({ generationId: "g1", uid: "x", costMicros: 3_000_000 }); // e.g. an aborted call counted at its estimate
  clock.now += 7 * MIN;
  core.setFloor(2_000_000); // report lags: recent usage, nothing lowered
  assert.equal(core.budgetReport().monthSpendMicros, 3_000_000);
  clock.now += 2 * 60 * MIN; // no /usage for 2 h: the report has caught up
  core.setFloor(2_000_000);
  const r = core.budgetReport();
  assert.equal(r.monthSpendMicros, 2_000_000);
  assert.equal(r.daySpendMicros, 2_000_000);
  core.usage({ generationId: "g2", uid: "x", costMicros: 500_000 }); // counting continues from the billed value
  assert.equal(core.budgetReport().monthSpendMicros, 2_500_000);
  core.setFloor(2_400_000); // recent usage again: never lowered
  assert.equal(core.budgetReport().monthSpendMicros, 2_500_000);
});

test("usage: same generationId counted once; cost_day per account", () => {
  const { core } = setup();
  assert.equal(core.usage({ generationId: "g1", uid: "u1", costMicros: 200_000 }).counted, true);
  assert.equal(core.usage({ generationId: "g1", uid: "u1", costMicros: 200_000 }).counted, false);
  assert.equal(core.budgetReport().daySpendMicros, 200_000);
  core.usage({ generationId: "g2", uid: "u1", costMicros: 100_000 });
  assert.equal(code(core.admitCreate(who())), "cost_day");
});

test("watchdog: 20 messages over 15 min with no usage → degrade (cause watchdog); usage clears it", () => {
  const { core, clock } = setup();
  let transition = null;
  for (let i = 0; i < 20; i++) {
    clock.now += MIN;
    const r = core.admitCreate(who({ uid: `w${i}`, tier: "staff", staff: true }));
    if (r.ok && r.transition) transition = r.transition;
  }
  assert.deepEqual(transition, { state: "degrade", cause: "watchdog" });
  assert.equal(core.budgetFor("free").budget, "degrade");
  const after = core.usage({ generationId: "gw", uid: "x", costMicros: 1 });
  assert.equal(after.transition?.state, "normal");
});

test("erase: counters reset, old sessions not_owner, pre-delete token refused for 1 h", () => {
  const { core, clock } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  const sessions = core.erase("u1");
  assert.deepEqual(sessions, ["S1"]);
  assert.equal(core.me(who()).day.used, 0);
  assert.equal(code(core.session("u1", "S1")), "not_owner");
  assert.equal(core.isTombstoned("u1", T0 - MIN), true);
  assert.equal(core.isTombstoned("u1", clock.now + 1000), false); // a token issued after the erase
  clock.now += 61 * MIN;
  assert.equal(core.isTombstoned("u1", T0 - MIN), false);
});

test("alarm sweep: idle sessions (25 h), generations (48 h), tombstones (1 h), counters (35 d)", () => {
  const { core, clock, store } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  core.usage({ generationId: "g1", uid: "u1", costMicros: 1 });
  core.erase("u9");
  clock.now += 26 * 3600_000;
  let r = core.sweep();
  assert.equal(r.sessions, 1); assert.equal(r.tombstones, 1); assert.equal(r.generations, 0);
  clock.now += 24 * 3600_000;
  r = core.sweep();
  assert.equal(r.generations, 1);
  clock.now += 35 * 24 * 3600_000;
  r = core.sweep();
  assert.equal(r.users, 1);
  assert.equal([...store.list("u:")].length, 0);
});

test("redeem: 10/min per IP", () => {
  const { core } = setup();
  for (let i = 0; i < 10; i++) ok(core.admitRedeem("9.9.9.9"));
  assert.equal(code(core.admitRedeem("9.9.9.9")), "ip");
  ok(core.admitRedeem("8.8.8.8"));
});

test("erase prep: sessionsOf lists the uid's sessions; tombstone alone keeps them", () => {
  const { core } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  ok(core.admitCreate(who())); core.bindSession("u1", "S2", "docs");
  core.tombstone("u1");
  assert.deepEqual(core.sessionsOf("u1"), ["S1", "S2"]);
  assert.equal(core.isTombstoned("u1", T0 - MIN), true);
  assert.equal(core.session("u1", "S1").ok, true, "still owned until eve confirms");
  assert.deepEqual(core.sessionsOf("nobody"), []);
});

test("QA-1 S7: no usage for 2 h while 60+ messages flow → free accounts pause (cause watchdog); owners degrade; usage clears it", () => {
  const { core, clock } = setup();
  let pause = null;
  for (let i = 0; i < 61; i++) {
    clock.now += 2 * MIN + 5_000;
    const r = core.admitCreate(who({ uid: `p${i}`, tier: "owner" }));
    if (r.ok && r.kind === "new" && r.transition?.state === "free_paused") pause = r.transition;
  }
  assert.deepEqual(pause, { state: "free_paused", cause: "watchdog" });
  assert.equal(core.budgetFor("free").budget, "paused");
  assert.equal(core.budgetFor("owner").budget, "degrade");
  assert.equal(core.usage({ generationId: "g-s7", uid: "x", costMicros: 1 }).transition?.state, "normal");
  assert.equal(core.budgetFor("free").budget, "normal");
});

test("guardrails: 3 points → 10 min cooldown at admit (429 cooldown), 6 → 1 h, 10 → 24 h; turnId de-duped; staff exempt", () => {
  const { core, clock } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  const st = (t: string, r: "offtopic" | "jailbreak" | "harmful" = "offtopic") => core.strike("u1", "S1", t, r) as Exclude<ReturnType<LimiterCore["strike"]>, { ok: false }>;
  assert.equal(st("t1").total, 1);
  assert.equal(st("t1").counted, false, "same turn twice");
  assert.equal(st("t2").startedMs, 0);
  const third = st("t3");
  assert.equal(third.total, 3); assert.equal(third.startedMs, 10 * MIN);
  clock.now += MIN;
  const c = core.admitCreate(who());
  assert.equal(code(c), "cooldown");
  assert.ok(!c.ok && c.retryAfter! > 8 * 60 && c.retryAfter! <= 9 * 60);
  assert.equal(code(core.admitFollowup(who(), "S1", crypto.randomUUID())), "cooldown");
  ok(core.admitCreate(who({ tier: "staff", staff: true })));
  assert.ok(core.me(who()).cooldownUntil);
  clock.now += 10 * MIN;
  ok(core.admitCreate(who()));
  assert.equal(st("t4", "jailbreak").total, 5);
  const six = st("t5");
  assert.equal(six.total, 6); assert.equal(six.startedMs, 60 * MIN); assert.equal(six.longest, false);
  clock.now += 61 * MIN;
  st("t6", "harmful");
  const ten = st("t7", "harmful");
  assert.equal(ten.total, 10); assert.equal(ten.startedMs, 24 * 60 * MIN); assert.equal(ten.longest, true);
  // the window is rolling: 24 h after the strikes, points are gone and the cooldown has ended
  clock.now += 25 * 60 * MIN;
  ok(core.admitCreate(who()));
  assert.equal(st("t8").total, 1);
});

test("guardrails: a strike naming another uid's session is refused; erase clears strikes", () => {
  const { core } = setup();
  ok(core.admitCreate(who())); core.bindSession("u1", "S1", "docs");
  assert.equal(code(core.strike("u2", "S1", "t1", "offtopic") as { ok: boolean; code?: string }), "not_owner");
  for (const t of ["a", "b", "c"]) core.strike("u1", "S1", t, "offtopic");
  assert.ok(core.cooldownLeft({ uid: "u1", tier: "free" }) > 0);
  core.erase("u1");
  assert.equal(core.cooldownLeft({ uid: "u1", tier: "free" }), 0);
});

test("guardrails: strikes de-dupe on (session, turn): turn_0 of two chats counts twice → cooldown", () => {
  const { core } = setup();
  core.strike("u1", "S1", "turn_0", "offtopic");
  const second = core.strike("u1", "S2", "turn_0", "jailbreak") as { counted: boolean; total: number; startedMs: number };
  assert.equal(second.counted, true);
  assert.equal(second.total, 3);
  assert.equal(second.startedMs, 10 * MIN);
  assert.equal((core.strike("u1", "S2", "turn_0", "jailbreak") as { counted: boolean }).counted, false, "same session + turn again");
});

test("QA-2 #8: a replayed stream read (old turn.settled) doesn't clear turn_running; the running turn's own settle does", () => {
  const { core, clock } = setup();
  const w = who({ tier: "staff", staff: true });
  ok(core.admitCreate(w)); core.bindSession("u1", "S1", "docs"); core.turnAccepted("S1", "d0");
  core.turnSignal("S1", { kind: "started", deliveryId: "d0", turnId: "turn_0" });
  core.turnSignal("S1", { kind: "settled", turnId: "turn_0", at: clock.now });
  clock.now += MIN;
  ok(core.admitFollowup(w, "S1", crypto.randomUUID())); core.turnAccepted("S1", "d1");
  // a startIndex=0 / follow=false read replays turn_0 from the start
  core.turnSignal("S1", { kind: "started", deliveryId: "d0", turnId: "turn_0" });
  core.turnSignal("S1", { kind: "settled", turnId: "turn_0", at: clock.now - MIN });
  assert.equal(code(core.admitFollowup(w, "S1", crypto.randomUUID())), "turn_running", "replay must not clear it");
  core.turnSignal("S1", { kind: "started", deliveryId: "d1", turnId: "turn_1" });
  core.turnSignal("S1", { kind: "settled", turnId: "turn_1", at: clock.now });
  assert.equal(ok(core.admitFollowup(w, "S1", crypto.randomUUID())).kind, "new");
});

test("QA-2 #8: lines that arrive before eve's 202 is recorded still clear the running turn", () => {
  const { core, clock } = setup();
  const w = who({ tier: "staff", staff: true });
  ok(core.admitCreate(w)); core.bindSession("u1", "S1", "docs");
  core.turnSignal("S1", { kind: "started", deliveryId: "d0", turnId: "turn_0" });
  core.turnSignal("S1", { kind: "settled", turnId: "turn_0", at: clock.now });
  core.turnAccepted("S1", "d0"); // the 202 lands last
  clock.now += MIN;
  assert.equal(ok(core.admitFollowup(w, "S1", crypto.randomUUID())).kind, "new");
});

test("QA-2 #8: without a known deliveryId, only a settle written after the admission counts", () => {
  const { core, clock } = setup();
  const w = who({ tier: "staff", staff: true });
  ok(core.admitCreate(w)); core.bindSession("u1", "S1", "docs"); core.turnSignal("S1", { kind: "settled", turnId: "turn_0", at: clock.now });
  clock.now += MIN;
  ok(core.admitFollowup(w, "S1", crypto.randomUUID())); core.turnAccepted("S1", null);
  core.turnSignal("S1", { kind: "settled", turnId: "turn_0", at: clock.now - MIN });
  assert.equal(code(core.admitFollowup(w, "S1", crypto.randomUUID())), "turn_running");
  core.turnSignal("S1", { kind: "settled", turnId: "turn_1", at: clock.now + 1000 });
  assert.equal(ok(core.admitFollowup(w, "S1", crypto.randomUUID())).kind, "new");
});
