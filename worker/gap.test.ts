import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LimiterCore, MapStore, type Who } from "./limiter/core.ts";
import { DEFAULT_LIMITS } from "./env.ts";
import { handleInternal } from "./internal.ts";
import { deskGapBody, parseGap, stuckGap } from "./gap.ts";
import { pidFor } from "./crypto.ts";
import type { Ctx } from "./context.ts";

const T0 = Date.UTC(2026, 10, 26, 12, 0, 0);
const SECRET = "internal-secret";

let core: LimiterCore;
let pending: Promise<unknown>[];
let calls: { url: string; body: any; headers: Record<string, string> }[];
let eveAnswer: unknown;
let ctx: Ctx;

const who = (uid = "u1"): Who => ({ uid, tier: "free", staff: false, ip: "1.1.1.1", newAccount: false, issuedAt: T0 - 60_000 });

beforeEach(() => {
  core = new LimiterCore(new MapStore(), DEFAULT_LIMITS, () => T0);
  pending = [];
  calls = [];
  eveAnswer = { gap: null };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    if (url.endsWith("/eve/v1/andronix/gap-stuck")) return new Response(JSON.stringify(eveAnswer), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ ticketRef: "T-000001", count: 1 }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  ctx = {
    env: { CHAT_INTERNAL_SECRET: SECRET, DESK_API_URL: "https://desk.test", DESK_API_KEY: "chat-key", EVE_ORIGIN: "https://eve.test", EVE_EDGE_SECRET: "edge" } as never,
    exec: { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as never,
    limits: DEFAULT_LIMITS,
    limiter: { call: async (m: string, ...a: unknown[]) => (core as any)[m](...a) } as never,
  };
  core.admitCreate(who());
  core.bindSession("u1", "S1", "docs");
});

const gap = (over: Record<string, unknown> = {}) => ({
  uid: "u1", sessionId: "S1", turnId: "turn_0", reason: "no_docs", topic: "Swap file in Ubuntu",
  summary: "Wants a swap file in Ubuntu.", pagesTried: ["use/performance"], source: "model", auto: false, ...over,
});
const post = (body: unknown, secret: string | null = SECRET) =>
  handleInternal(ctx, new Request("https://docs.test/chat-api/internal/gap", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(secret ? { "x-chat-internal": secret } : {}) },
  }), new URL("https://docs.test/chat-api/internal/gap"));
const settle = () => Promise.all(pending);
const deskCalls = () => calls.filter((c) => c.url === "https://desk.test/api/agent/kb-gap");

test("/gap needs x-chat-internal: none or wrong → 401, nothing sent", async () => {
  assert.equal((await post(gap(), null)).status, 401);
  assert.equal((await post(gap(), "nope")).status, 401);
  await settle();
  assert.equal(calls.length, 0);
});

test("/gap strict body: extra keys, bad enums, long text → 400", async () => {
  for (const b of [{ ...gap(), message: "raw" }, gap({ reason: "money" }), gap({ source: "page" }), gap({ topic: "x".repeat(81) }), gap({ summary: "x".repeat(301) }), gap({ pagesTried: ["a", "b", "c", "d", "e", "f"] }), gap({ auto: "yes" })]) {
    assert.equal((await post(b)).status, 400, JSON.stringify(b).slice(0, 80));
  }
  const { uid: _u, ...noUid } = gap();
  assert.equal((await post(noUid)).status, 400);
});

test("/gap: another uid's session → 403 not_owner", async () => {
  assert.equal((await post(gap({ uid: "u2" }))).status, 403);
});

test("/gap forwards once per (session, turn, source) with the desk's chat key; no uid, pid or email leaves", async () => {
  assert.equal((await post(gap())).status, 204);
  assert.equal((await post(gap())).status, 204); // eve retry: de-duplicated
  assert.equal((await post(gap({ source: "no_answer", auto: true }))).status, 204); // other source, same turn: kept
  assert.equal((await post(gap({ turnId: "turn_1" }))).status, 204);
  await settle();
  const d = deskCalls();
  assert.equal(d.length, 3);
  assert.equal(d[0]!.headers.authorization, "Bearer chat-key");
  assert.deepEqual(d[0]!.body, {
    idempotencyKey: "S1:turn_0:model", reason: "no_docs", topic: "Swap file in Ubuntu", summary: "Wants a swap file in Ubuntu.",
    pagesTried: ["use/performance"], source: "model", auto: false, entry: "docs", sessionId: "S1", turnId: "turn_0",
  });
  const pid = await pidFor("u1");
  for (const c of d) assert.ok(!JSON.stringify(c.body).includes("u1") && !JSON.stringify(c.body).includes(pid));
});

test("gaps never touch the user's limits", async () => {
  const before = JSON.stringify(core.me(who()));
  for (let i = 0; i < 5; i++) await post(gap({ turnId: `turn_${i}` }));
  assert.equal(JSON.stringify(core.me(who())), before);
});

test("parseGap and deskGapBody", () => {
  assert.equal(parseGap(null), null);
  assert.equal(parseGap([]), null);
  assert.ok(parseGap(gap()));
  assert.equal(deskGapBody(parseGap(gap({ topic: " t ", summary: " s " }))!, "app_help").topic, "t");
});

test("Still stuck: asks eve with the pid, forwards the gap eve built", async () => {
  eveAnswer = { gap: gap({ reason: "partial", source: "still_stuck", auto: true, summary: "The user tapped Still stuck after this answer." }) };
  assert.equal(await stuckGap(ctx, "u1", "S1", "turn_0"), "ok");
  await settle();
  const ask = calls.find((c) => c.url === "https://eve.test/eve/v1/andronix/gap-stuck")!;
  assert.deepEqual(ask.body, { pid: await pidFor("u1"), sessionId: "S1", turnId: "turn_0" });
  assert.equal(ask.headers["x-eve-edge"], "edge");
  assert.equal(ask.headers["x-chat-internal"], SECRET);
  assert.equal(deskCalls().length, 1);
  assert.equal(deskCalls()[0]!.body.source, "still_stuck");
  // a second tap path (same turn) is de-duplicated
  assert.equal(await stuckGap(ctx, "u1", "S1", "turn_0"), "dup");
});

test("Still stuck: eve's null, or a gap for other ids, sends nothing", async () => {
  assert.equal(await stuckGap(ctx, "u1", "S1", "turn_0"), "none");
  eveAnswer = { gap: gap({ source: "still_stuck", turnId: "turn_9" }) };
  assert.equal(await stuckGap(ctx, "u1", "S1", "turn_0"), "none");
  eveAnswer = { gap: gap({ source: "model" }) };
  assert.equal(await stuckGap(ctx, "u1", "S1", "turn_0"), "none");
  await settle();
  assert.equal(deskCalls().length, 0);
});

test("DO gap(): owner check and de-dup live in the session record", () => {
  assert.equal(core.gap("u2", "S1", "turn_0", "model").ok, false);
  assert.deepEqual(core.gap("u1", "S1", "turn_0", "model"), { ok: true, first: true, entry: "docs" });
  assert.deepEqual(core.gap("u1", "S1", "turn_0", "model"), { ok: true, first: false, entry: "docs" });
  core.erase("u1");
  assert.equal(core.gap("u1", "S1", "turn_1", "model").ok, false);
});
