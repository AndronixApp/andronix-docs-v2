// Integration tests for the chat Worker (build plan 2B acceptance, Worker rows), against the
// local stack: `pnpm chat:emulator`, `pnpm chat:fakes`, `pnpm chat:dev`. Run: `pnpm test:chat-int`.
// Each test uses fresh accounts, so the shared DO never needs a reset.

import { test } from "node:test";
import assert from "node:assert/strict";

const W = process.env.CHAT_WORKER ?? "http://127.0.0.1:8799";
const FAKES = "http://127.0.0.1:8790";
const AUTH = "http://127.0.0.1:9199";
const PROJECT = "demo-andronix";
const INTERNAL = { "x-chat-internal": "dev-internal-secret", "content-type": "application/json" };
const run = Math.random().toString(36).slice(2, 8);
let n = 0;

async function account({ verified = true, staff = false, tier = "free", young = false } = {}) {
  const email = `t${run}-${++n}@dev.andronix.app`;
  const su = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "andronix-dev-1", returnSecureToken: true }),
  })).json();
  const uid = su.localId;
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ localId: uid, emailVerified: verified, customAttributes: JSON.stringify(staff ? { support_staff: true } : {}) }),
  });
  await fetch(`${FAKES}/fake/accounts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ [uid]: { tier, createdAt: young ? new Date().toISOString() : "2025-01-01T00:00:00Z" } }) });
  const token = async () => (await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "andronix-dev-1", returnSecureToken: true }),
  })).json()).idToken;
  const a = { uid, email, token: await token(), ip: `10.${n % 250}.${run.charCodeAt(0) % 250}.1` };
  a.refresh = async () => { a.token = await token(); };
  a.verify = async () => {
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
    await a.refresh();
  };
  return a;
}

const h = (a, extra = {}) => ({ authorization: `Bearer ${a.token}`, "content-type": "application/json", "cf-connecting-ip": a.ip, ...extra });
const post = (a, path, body, extra) => fetch(W + path, { method: "POST", headers: h(a, extra), body: JSON.stringify(body) });
const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });
const advance = (ms) => fetch(`${W}/chat-api/dev/advance?ms=${ms}`, { method: "POST" });
const uuid = () => crypto.randomUUID();

async function create(a, message = "fixture:01 hello", extra = {}) {
  const r = await json(await post(a, "/eve/v1/session", { message, entry: "docs", ...extra }));
  return r;
}
/** Reads the whole stream once (follow=false) so the Worker sees turn.settled. */
async function drain(a, sessionId) {
  const res = await fetch(`${W}/eve/v1/session/${sessionId}/stream?follow=false`, { headers: h(a) });
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const me = async (a) => (await json(await fetch(`${W}/chat-api/me`, { headers: h(a) }))).body;

test("auth: no token, bad token → 401 auth", async () => {
  assert.equal((await json(await fetch(`${W}/chat-api/me`))).body.code, "auth");
  assert.equal((await json(await fetch(`${W}/chat-api/me`, { headers: { authorization: "Bearer x.y.z" } }))).body.code, "auth");
});

test("me: tiers, verified, newAccount", async () => {
  const free = await account();
  let m = await me(free);
  assert.equal(m.tier, "free"); assert.equal(m.verified, true); assert.equal(m.newAccount, false); assert.equal(m.limits.day.max, 10);
  assert.match(m.pid, /^[0-9a-f]{32}$/);
  const staff = await account({ staff: true });
  m = await me(staff); assert.equal(m.tier, "staff"); assert.equal(m.limits.day.max, 200);
  const owner = await account({ tier: "owner" });
  m = await me(owner); assert.equal(m.tier, "owner"); assert.equal(m.limits.day.max, 30);
  const unv = await account({ verified: false });
  m = await me(unv); assert.equal(m.newAccount, true); assert.equal(m.limits.day.max, 3);
});

test("body rules: eve's other fields → bad_body; 2,001 chars → message_too_long", async () => {
  const a = await account({ staff: true });
  for (const k of ["answers", "clientContext", "outputSchema", "turnPolicy", "stubs"]) {
    assert.equal((await create(a, "hi", { [k]: [] })).body.code, "bad_body", k);
  }
  assert.equal((await json(await post(a, "/eve/v1/session", { message: [{ type: "file", url: "x" }], entry: "docs" }))).body.code, "bad_body");
  assert.equal((await create(a, "x".repeat(2001))).body.code, "message_too_long");
});

test("create → fake eve got {message} only, masked, with edge and x-andronix-* headers; chat_message_sent masked", async () => {
  await fetch(`${FAKES}/fake/requests`, { method: "DELETE" });
  await fetch(`${FAKES}/fake/events`, { method: "DELETE" });
  const a = await account();
  const r = await create(a, "fixture:01 I am me@example.com, order GPA.1234-5678-9012-34567 failed");
  assert.equal(r.status, 202);
  assert.match(r.body.sessionId, /^wrun_fake_01_/);
  const seen = (await (await fetch(`${FAKES}/fake/requests`)).json()).filter((x) => x.kind === "create");
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].problems, []);
  assert.deepEqual(Object.keys(seen[0].body), ["message"]);
  assert.equal(seen[0].body.message, "fixture:01 I am [email], order [order id] failed");
  assert.equal(seen[0].headers["x-andronix-entry"], "docs");
  assert.equal(seen[0].headers["x-andronix-surface"], "web");
  assert.equal(seen[0].headers["x-andronix-tier"], "free");
  assert.equal(seen[0].headers["x-andronix-budget"], "normal");
  await new Promise((r) => setTimeout(r, 300));
  const ev = (await (await fetch(`${FAKES}/fake/events`)).json()).filter((e) => e?.payload?.name === "chat_message_sent");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].payload.properties.masked, true);
  assert.equal(ev[0].payload.properties.chars_bucket, "50-200");
  assert.match(ev[0].payload.properties.chat_id, /^[0-9a-f]{16}$/);
  assert.ok(!JSON.stringify(ev[0]).includes("example.com"));
});

test("entry and clientMsgId may come as per-send headers (pinned useEveAgent)", async () => {
  const a = await account();
  const res = await fetch(W + "/eve/v1/session", { method: "POST", headers: h(a, { "x-chat-entry": "discord", "x-chat-client-msg-id": uuid() }), body: JSON.stringify({ message: "fixture:01 hi" }) });
  assert.equal(res.status, 202);
  const seen = (await (await fetch(`${FAKES}/fake/requests`)).json()).filter((x) => x.kind === "create").at(-1);
  assert.equal(seen.headers["x-andronix-entry"], "discord");
});

test("follow-ups: turn_running before the turn ends; stream sniff clears it; same clientMsgId counts once", async () => {
  const a = await account({ staff: true });
  const { body } = await create(a);
  const sid = body.sessionId;
  const id = uuid();
  assert.equal((await json(await post(a, `/eve/v1/session/${sid}`, { message: "next", clientMsgId: id }))).body.code, "turn_running");
  const s = await drain(a, sid);
  assert.equal(s.status, 200);
  assert.equal(s.headers.get("x-eve-stream-version"), "27");
  assert.match(s.text, /turn\.settled/);
  await new Promise((r) => setTimeout(r, 200));
  const before = (await me(a)).limits.day.used;
  assert.equal((await post(a, `/eve/v1/session/${sid}`, { message: "next", clientMsgId: id })).status, 202);
  assert.equal((await post(a, `/eve/v1/session/${sid}`, { message: "next", clientMsgId: id })).status, 202); // retry, deduped
  assert.equal((await me(a)).limits.day.used, before + 1);
  const seen = (await (await fetch(`${FAKES}/fake/requests`)).json()).filter((x) => x.kind === "followup").at(-1);
  assert.deepEqual(Object.keys(seen.body).sort(), ["idempotencyKey", "message"]);
  assert.match(seen.body.idempotencyKey, /^[0-9a-f]{64}$/);
});

test("13th turn → chat_full", async () => {
  const a = await account({ staff: true });
  const { body } = await create(a, "fixture:05 hi");
  const sid = body.sessionId;
  await drain(a, sid);
  for (let t = 2; t <= 12; t++) {
    if (t % 9 === 0) await advance(61_000); // staff 10/min
    const r = await post(a, `/eve/v1/session/${sid}`, { message: `turn ${t}`, clientMsgId: uuid() });
    assert.equal(r.status, 202, `turn ${t}: ${await r.text()}`);
    await drain(a, sid);
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal((await json(await post(a, `/eve/v1/session/${sid}`, { message: "13", clientMsgId: uuid() }))).body.code, "chat_full");
});

test("cancel: {turnId} OK, {} OK, {message} → bad_body; other uid → not_owner", async () => {
  const a = await account({ staff: true });
  const b = await account();
  const { body } = await create(a, "fixture:09 slow");
  const sid = body.sessionId;
  assert.equal((await json(await post(a, `/eve/v1/session/${sid}/cancel`, { message: "x" }))).body.code, "bad_body");
  assert.equal((await post(a, `/eve/v1/session/${sid}/cancel`, { turnId: "turn_0" })).status, 202);
  assert.equal((await post(a, `/eve/v1/session/${sid}/cancel`, {})).status, 202);
  assert.equal((await json(await post(b, `/eve/v1/session/${sid}/cancel`, {}))).body.code, "not_owner");
});

test("ownership: B → A's stream, follow-up, ticket, feedback, report-attach → not_owner", async () => {
  const a = await account();
  const b = await account();
  const { body } = await create(a);
  const sid = body.sessionId;
  assert.equal((await json(await fetch(`${W}/eve/v1/session/${sid}/stream`, { headers: h(b) }))).body.code, "not_owner");
  assert.equal((await json(await post(b, `/eve/v1/session/${sid}`, { message: "x" }))).body.code, "not_owner");
  assert.equal((await json(await post(b, "/chat-api/ticket", { sessionId: sid, reason: "stuck", includeChat: true }))).body.code, "not_owner");
  assert.equal((await json(await post(b, "/chat-api/feedback", { sessionId: sid, turnId: "turn_0", value: "solved" }))).body.code, "not_owner");
  assert.equal((await json(await post(b, "/chat-api/report-attach", { sessionId: sid, reportId: "AX-FAKE01" }))).body.code, "not_owner");
});

test("streams: 4th concurrent → streams; a slot frees when eve ends the lease; bad query → bad_body", async () => {
  const a = await account();
  const { body } = await create(a);
  const sid = body.sessionId;
  assert.equal((await json(await fetch(`${W}/eve/v1/session/${sid}/stream?evil=1`, { headers: h(a) }))).body.code, "bad_body");
  const ctrls = [];
  for (let i = 0; i < 3; i++) {
    const c = new AbortController(); ctrls.push(c);
    const res = await fetch(`${W}/eve/v1/session/${sid}/stream`, { headers: h(a), signal: c.signal });
    assert.equal(res.status, 200);
    (async () => { const r = res.body.getReader(); try { for (;;) if ((await r.read()).done) break; } catch {} })();
  }
  const fourth = await json(await fetch(`${W}/eve/v1/session/${sid}/stream`, { headers: h(a) }));
  assert.equal(fourth.status, 429); assert.equal(fourth.body.code, "streams"); assert.ok(fourth.body.retryAfter > 0);
  // local workerd doesn't cancel the body on a client disconnect; the slot frees when eve's
  // lease ends (fake: 12 s, eve: 60 s), or after the 90 s lease TTL
  await new Promise((r) => setTimeout(r, 16_000)); // replay (~2 s) + 12 s lease
  const again = await fetch(`${W}/eve/v1/session/${sid}/stream?follow=false`, { headers: h(a) });
  assert.equal(again.status, 200); await again.text();
  for (const c of ctrls) c.abort();
});

test("limits: free 10/day with rate_minute; unverified 3/day then verify → 10", async () => {
  const a = await account();
  const codes = [];
  for (let i = 0; i < 11; i++) {
    if (i && i % 3 === 0) await advance(61_000);
    const r = await create(a);
    codes.push(r.status === 202 ? "ok" : r.body.code);
    if (i === 2) codes.push((await create(a)).body.code); // 4th in the minute
  }
  assert.equal(codes[3], "rate_minute");
  assert.equal(codes.filter((c) => c === "ok").length, 10);
  assert.equal(codes.at(-1), "rate_day");
  const u = await account({ verified: false });
  for (let i = 0; i < 3; i++) assert.equal((await create(u)).status, 202);
  await advance(61_000);
  const nr = await create(u);
  assert.equal(nr.body.code, "new_account"); assert.ok(nr.body.retryAfter > 0);
  await u.verify();
  await advance(61_000);
  assert.equal((await create(u)).status, 202, "verified now: free tier");
});

test("owner 30/day", async () => {
  const o = await account({ tier: "owner" });
  let ok = 0;
  for (let i = 0; i < 31; i++) { if (i % 3 === 0) await advance(61_000); if ((await create(o)).status === 202) ok++; }
  assert.equal(ok, 30);
});

test("new_ip: 31st young uid from one IP; 20 old accounts from one IP chat freely", async () => {
  const ip = `172.16.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const codes = [];
  for (let i = 0; i < 31; i++) { const y = await account({ young: true }); y.ip = ip; codes.push((await create(y)).body.code ?? "ok"); }
  assert.equal(codes.filter((c) => c === "ok").length, 30);
  assert.equal(codes[30], "new_ip");
  const ip2 = `172.17.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  for (let i = 0; i < 20; i++) { const o = await account(); o.ip = ip2; assert.equal((await create(o)).status, 202); }
});

test("tickets: 3/day, the 4th → tickets; transcript from eve; distinct keys without sessionId", async () => {
  const a = await account();
  const { body } = await create(a, "fixture:06 install fails");
  await drain(a, body.sessionId);
  const t1 = await json(await post(a, "/chat-api/ticket", { sessionId: body.sessionId, reason: "stuck", topic: "install", includeChat: true, note: "help" }));
  assert.equal(t1.status, 200); assert.match(t1.body.ticketRef, /^FAKE-/);
  const again = await json(await post(a, "/chat-api/ticket", { sessionId: body.sessionId, reason: "stuck", includeChat: true }));
  assert.equal(again.body.ticketRef, t1.body.ticketRef, "1 per session per reason");
  assert.equal((await post(a, "/chat-api/ticket", { reason: "money", includeChat: false, orderId: "GPA.1234-5678-9012-34567" })).status, 200);
  assert.equal((await post(a, "/chat-api/ticket", { reason: "account", includeChat: false })).status, 200);
  assert.equal((await json(await post(a, "/chat-api/ticket", { reason: "user_request", includeChat: false }))).body.code, "tickets");
  assert.equal((await json(await post(a, "/chat-api/ticket", { reason: "money", includeChat: false, orderId: "GPA.bad" }))).body.code, "bad_body");
  assert.equal((await json(await post(a, "/chat-api/ticket", { reason: "money", includeChat: false, note: "n".repeat(2001) }))).body.code, "bad_body");
});

test("feedback: 204, second on the same turn ignored", async () => {
  const a = await account();
  const { body } = await create(a);
  assert.equal((await post(a, "/chat-api/feedback", { sessionId: body.sessionId, turnId: "turn_0", value: "solved" })).status, 204);
  assert.equal((await post(a, "/chat-api/feedback", { sessionId: body.sessionId, turnId: "turn_0", value: "stuck" })).status, 204);
});

test("report-attach: fake desk owns AX-FAKE01; unknown → not_owner; eve reads it via /internal/report", async () => {
  const a = await account();
  const { body } = await create(a);
  assert.equal((await json(await post(a, "/chat-api/report-attach", { sessionId: body.sessionId, reportId: "AX-NOPE99" }))).body.code, "not_owner");
  assert.equal((await post(a, "/chat-api/report-attach", { sessionId: body.sessionId, reportId: "AX-FAKE01" })).status, 200);
  const r = await json(await fetch(`${W}/chat-api/internal/report`, { method: "POST", headers: INTERNAL, body: JSON.stringify({ uid: a.uid, sessionId: body.sessionId }) }));
  assert.equal(r.body.attached, true); assert.equal(r.body.distro, "debian");
  const none = await json(await fetch(`${W}/chat-api/internal/report`, { method: "POST", headers: INTERNAL, body: JSON.stringify({ uid: "other", sessionId: body.sessionId }) }));
  assert.equal(none.body.attached, false);
});

test("internal routes need the secret", async () => {
  assert.equal((await fetch(`${W}/chat-api/internal/budget`)).status, 401);
  assert.equal((await fetch(`${W}/chat-api/internal/budget`, { headers: { "x-chat-internal": "wrong" } })).status, 401);
  assert.equal((await fetch(`${W}/chat-api/internal/erase`, { method: "POST", headers: { authorization: "Bearer wrong", "content-type": "application/json" }, body: "{}" })).status, 401);
  assert.equal((await fetch(`${W}/chat-api/internal/budget`, { headers: INTERNAL })).status, 200);
});

test("redeem: right verifier once, then code_used; wrong verifier → 403 and burned; 10/min per IP", async () => {
  const code = `devcode${run}${"0".repeat(12)}`;
  await fetch(`${FAKES}/fake/handoff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: "handoff-user-" + run, entry: "app_help", code, verifier: "dev-verifier-000000000000000" }) });
  const ip = { "cf-connecting-ip": `192.0.2.${run.charCodeAt(2) % 250}`, "content-type": "application/json" };
  const ok = await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: ip, body: JSON.stringify({ code, verifier: "dev-verifier-000000000000000" }) }));
  assert.equal(ok.status, 200); assert.equal(ok.body.entry, "app_help"); assert.ok(ok.body.customToken);
  assert.equal((await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: ip, body: JSON.stringify({ code, verifier: "dev-verifier-000000000000000" }) }))).body.code, "code_used");
  const code2 = `devcode2${run}${"0".repeat(12)}`;
  await fetch(`${FAKES}/fake/handoff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: "h2", entry: "app_help", code: code2, verifier: "dev-verifier-000000000000000" }) });
  const bad = await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: ip, body: JSON.stringify({ code: code2, verifier: "wrong-verifier-00000000000000" }) }));
  assert.equal(bad.status, 403); assert.equal(bad.body.code, "verifier_mismatch");
  assert.equal((await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: ip, body: JSON.stringify({ code: code2, verifier: "dev-verifier-000000000000000" }) }))).body.code, "code_used", "burned");
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: ip, body: JSON.stringify({ code: "nope0000000000000000", verifier: "nope0000000000000000" }) }))).body.code);
  assert.equal(codes.at(-1), "ip");
});

test("custom-token session with chat_entry signs in and chats; without chat_entry → 401", async () => {
  const uid = `handoff-${run}`;
  const code = `devcode3${run}${"0".repeat(12)}`;
  await fetch(`${FAKES}/fake/handoff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid, entry: "app_install_failed", code, verifier: "dev-verifier-000000000000000" }) });
  const r = await json(await fetch(`${W}/chat-api/redeem`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100.7" }, body: JSON.stringify({ code, verifier: "dev-verifier-000000000000000" }) }));
  const signIn = async (customToken) => (await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) })).json()).idToken;
  const idToken = await signIn(r.body.customToken);
  assert.ok(idToken);
  assert.equal((await fetch(`${W}/chat-api/me`, { headers: { authorization: `Bearer ${idToken}` } })).status, 200);
  // a custom token minted without chat_entry (not by the chat handoff)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const plain = `${b64({ alg: "none", typ: "JWT" })}.${b64({ aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: now, exp: now + 3600, iss: "x@example.com", sub: "x@example.com", uid: `plain-${run}` })}.`;
  const t2 = await signIn(plain);
  assert.equal((await json(await fetch(`${W}/chat-api/me`, { headers: { authorization: `Bearer ${t2}` } }))).body.code, "auth");
});

test("usage: same generationId once; erase → counters reset, sessions gone, old token 401", async () => {
  // tombstones compare with real token iat: undo the dev clock offset earlier tests added
  const { offsetMs } = await (await advance(0)).json();
  await advance(-offsetMs);
  const a = await account();
  const { body } = await create(a);
  const u = { generationId: `gen-${run}`, uid: a.uid, sessionId: body.sessionId, turnId: "turn_0", model: "x", inputTokens: 1, outputTokens: 1, cachedTokens: 0, costMicros: 10 };
  const before = (await json(await fetch(`${W}/chat-api/internal/budget`, { headers: INTERNAL }))).body.daySpendMicros;
  for (let i = 0; i < 2; i++) assert.equal((await fetch(`${W}/chat-api/internal/usage`, { method: "POST", headers: INTERNAL, body: JSON.stringify(u) })).status, 204);
  const after = (await json(await fetch(`${W}/chat-api/internal/budget`, { headers: INTERNAL }))).body.daySpendMicros;
  assert.equal(after - before, 10);
  assert.equal((await fetch(`${W}/chat-api/internal/erase`, { method: "POST", headers: { authorization: "Bearer dev-service-secret", "content-type": "application/json" }, body: JSON.stringify({ uid: a.uid }) })).status, 204);
  assert.equal((await json(await fetch(`${W}/chat-api/me`, { headers: h(a) }))).body.code, "auth", "pre-delete token");
  await new Promise((r) => setTimeout(r, 1100));
  await a.refresh();
  assert.equal((await me(a)).limits.day.used, 0);
  assert.equal((await json(await fetch(`${W}/eve/v1/session/${body.sessionId}/stream`, { headers: h(a) }))).body.code, "not_owner");
});

test("/__/auth/* proxy: 30 rapid GETs all 200, never rate limited", async () => {
  const codes = await Promise.all(Array.from({ length: 30 }, () => fetch(`${W}/__/auth/iframe?apiKey=x`).then((r) => r.status)));
  assert.deepEqual([...new Set(codes)], [200]);
  const init = await fetch(`${W}/__/firebase/init.json`);
  assert.equal(init.status, 200);
  assert.equal((await init.json()).projectId, "andronix-techriz");
});

test("unknown /eve path → 404; static paths don't hit chat code", async () => {
  assert.equal((await fetch(`${W}/eve/v1/info`)).status, 404);
  assert.equal((await fetch(`${W}/eve/v1/session/x/end`, { method: "POST" })).status, 404);
});
