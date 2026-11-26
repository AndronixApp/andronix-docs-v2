import { test } from "node:test";
import assert from "node:assert/strict";
import { mask, parseCancel, parseCreate, parseFollowup, parseTicket } from "./body.ts";
import { transcriptFromNdjson } from "./chat.ts";
import { inRollout, parseLimits, parseRollout } from "./env.ts";
import { errorBody, HTTP_ERRORS } from "../lib/chat-contract/http/http-errors.ts";

const id = "6f1c2b8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const code = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

test("create: exact keys; eve's other fields → bad_body", () => {
  assert.equal(code(parseCreate({ message: "hi", entry: "docs" }, 2000)), "ok");
  assert.equal(code(parseCreate({ message: "hi", entry: "docs", clientMsgId: id }, 2000)), "ok");
  for (const extra of ["answers", "clientContext", "outputSchema", "turnPolicy", "files", "stubs", "inbox"]) {
    assert.equal(code(parseCreate({ message: "hi", entry: "docs", [extra]: [] }, 2000)), "bad_body", extra);
  }
  assert.equal(code(parseCreate({ message: [{ type: "file" }], entry: "docs" }, 2000)), "bad_body");
  assert.equal(code(parseCreate({ message: "hi", entry: "<script>" }, 2000)), "bad_body");
  assert.equal(code(parseCreate({ message: "hi" }, 2000)), "bad_body");
  assert.equal(code(parseCreate({ message: "hi", entry: "docs", clientMsgId: "nope" }, 2000)), "bad_body");
});

test("message: 1-2,000 characters after trim", () => {
  assert.equal(code(parseFollowup({ message: "x".repeat(2000) }, 2000)), "ok");
  assert.equal(code(parseFollowup({ message: "x".repeat(2001) }, 2000)), "message_too_long");
  assert.equal(code(parseFollowup({ message: "   " }, 2000)), "bad_body");
  assert.equal(code(parseFollowup({ message: "  ok  " }, 2000)), "ok");
});

test("cancel: {turnId} OK, {message} → bad_body", () => {
  assert.equal(code(parseCancel({ turnId: "t1" })), "ok");
  assert.equal(code(parseCancel({})), "ok");
  assert.equal(code(parseCancel({ message: "x" })), "bad_body");
});

test("ticket: note ≤2,000, orderId pattern, enums", () => {
  assert.equal(code(parseTicket({ reason: "money", includeChat: true, orderId: "GPA.1234-5678-9012-34567" })), "ok");
  assert.equal(code(parseTicket({ reason: "money", includeChat: true, orderId: "GPA.1234-5678-9012-34567..2" })), "ok");
  assert.equal(code(parseTicket({ reason: "money", includeChat: true, orderId: "GPA.12-34" })), "bad_body");
  assert.equal(code(parseTicket({ reason: "money", includeChat: true, note: "n".repeat(2001) })), "bad_body");
  assert.equal(code(parseTicket({ reason: "refund", includeChat: true })), "bad_body");
  assert.equal(code(parseTicket({ reason: "stuck", includeChat: false, topic: "install", extra: 1 })), "bad_body");
});

test("masking: emails and GPA order ids", () => {
  const r = mask("I am a.b+c@example.com, order GPA.3312-4455-6677-88990..1 failed");
  assert.equal(r.text, "I am [email], order [order id] failed");
  assert.equal(r.masked, true);
  assert.equal(mask("apt update fails").masked, false);
});

test("error bodies: 429/503 carry retryAfter, others don't", () => {
  assert.deepEqual(errorBody("rate_day", 120), { ok: false, code: "rate_day", error: HTTP_ERRORS.rate_day.error, retryAfter: 120 });
  assert.equal(errorBody("auth").retryAfter, undefined);
  assert.ok(errorBody("disabled").retryAfter! > 0);
});

test("limits JSON overrides merge per tier", () => {
  const l = parseLimits(JSON.stringify({ newUidsPerIpPerDay: 5, tiers: { free: { day: 20 } } }));
  assert.equal(l.newUidsPerIpPerDay, 5);
  assert.equal(l.tiers.free.day, 20);
  assert.equal(l.tiers.free.minute, 3);
  assert.equal(parseLimits("{bad").tiers.free.day, 10);
});

test("rollout: staff → owners → pct → all", () => {
  const pidLow = "00000001" + "0".repeat(24); // bucket 1
  const pidHigh = "000000ff" + "0".repeat(24); // bucket 255 % 100 = 55
  assert.equal(inRollout(parseRollout("staff"), "free", pidLow), false);
  assert.equal(inRollout(parseRollout("staff"), "staff", pidLow), true);
  assert.equal(inRollout(parseRollout("owners"), "owner", pidLow), true);
  assert.equal(inRollout(parseRollout("pct:10"), "free", pidLow), true);
  assert.equal(inRollout(parseRollout("pct:10"), "free", pidHigh), false);
  assert.equal(inRollout(parseRollout("all"), "new", pidHigh), true);
  assert.equal(inRollout(parseRollout(undefined), "free", pidLow), false);
});

test("transcript from eve lines: user parts and replies, last 24, ≤4,000 each", () => {
  const lines = [];
  for (let i = 0; i < 15; i++) {
    lines.push(JSON.stringify({ at: `2026-11-25T10:${String(i).padStart(2, "0")}:00Z`, facts: [{ type: "delivery.consumed", data: { deliveryId: `d${i}`, turnId: `t${i}`, parts: [{ kind: "text", text: `q${i}` }] } }] }));
    lines.push(JSON.stringify({ at: `2026-11-25T10:${String(i).padStart(2, "0")}:30Z`, facts: [{ type: "content.completed", data: { partId: `p${i}`, kind: "text", phase: "reply", value: "a".repeat(5000) } }] }));
    lines.push(JSON.stringify({ progress: { type: "content.delta", data: { partId: "x", delta: "zz" } } }));
  }
  const t = transcriptFromNdjson(lines.join("\n"));
  assert.equal(t.length, 24);
  assert.equal(t[0].role, "user");
  assert.equal(t[0].text, "q3");
  assert.equal(t[1].text.length, 4000);
});
