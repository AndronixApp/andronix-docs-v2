// Body rules for /eve/* POSTs and the masking of chat messages (build plan 1.4).
// The Worker builds the eve body itself; the client can't set eve's other fields.

import type { ErrorCode } from "../lib/chat-contract/http/http-errors.ts";

export const ENTRIES = ["docs", "discord", "app_help", "app_install_failed"] as const;
export type Entry = (typeof ENTRIES)[number];
export const isEntry = (v: unknown): v is Entry => typeof v === "string" && (ENTRIES as readonly string[]).includes(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Patterns from support-desk src/server/classify/redact.ts (EMAIL and ORDER_ID rules), output
// spelled as the plan asks: [email] and [order id].
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const ORDER_ID = /\bGPA\.[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}(?:\.\.\d+)?\b|\bGPA\.DEV-[A-Z0-9-]+\b/g;

export function mask(text: string): { text: string; masked: boolean } {
  const out = text.replace(ORDER_ID, "[order id]").replace(EMAIL, "[email]");
  return { text: out, masked: out !== text };
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

const fail = (code: ErrorCode) => ({ ok: false as const, code });

function exactKeys(body: unknown, required: string[], optional: string[]): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  if (!required.every((k) => keys.includes(k))) return false;
  return keys.every((k) => required.includes(k) || optional.includes(k));
}

function message(v: unknown, maxChars: number): Parsed<string> {
  if (typeof v !== "string") return fail("bad_body");
  const t = v.trim();
  if (t.length === 0) return fail("bad_body");
  if ([...t].length > maxChars) return fail("message_too_long");
  return { ok: true, value: t };
}

function clientMsgId(v: unknown): Parsed<string | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  return typeof v === "string" && UUID.test(v) ? { ok: true, value: v.toLowerCase() } : fail("bad_body");
}

export type CreateBody = { message: string; clientMsgId?: string; entry: Entry };
export type FollowupBody = { message: string; clientMsgId?: string };
export type CancelBody = { turnId?: string };

export function parseCreate(body: unknown, maxChars: number): Parsed<CreateBody> {
  if (!exactKeys(body, ["message", "entry"], ["clientMsgId"])) return fail("bad_body");
  if (!isEntry(body.entry)) return fail("bad_body");
  const m = message(body.message, maxChars);
  if (!m.ok) return m;
  const c = clientMsgId(body.clientMsgId);
  if (!c.ok) return c;
  return { ok: true, value: { message: m.value, clientMsgId: c.value, entry: body.entry } };
}

export function parseFollowup(body: unknown, maxChars: number): Parsed<FollowupBody> {
  if (!exactKeys(body, ["message"], ["clientMsgId"])) return fail("bad_body");
  const m = message(body.message, maxChars);
  if (!m.ok) return m;
  const c = clientMsgId(body.clientMsgId);
  if (!c.ok) return c;
  return { ok: true, value: { message: m.value, clientMsgId: c.value } };
}

export function parseCancel(body: unknown): Parsed<CancelBody> {
  if (body === null || body === undefined) return { ok: true, value: {} };
  if (!exactKeys(body, [], ["turnId"])) return fail("bad_body");
  if (body.turnId !== undefined && (typeof body.turnId !== "string" || body.turnId.length === 0 || body.turnId.length > 200)) return fail("bad_body");
  return { ok: true, value: { turnId: body.turnId as string | undefined } };
}

// POST /chat-api/ticket (1.4): note ≤2,000, orderId pattern.
export const ORDER_ID_PATTERN = /^GPA\.\d{4}-\d{4}-\d{4}-\d{5}(\.\.\d+)?$/;
export const TICKET_REASONS = ["money", "account", "stuck", "user_request", "limit"] as const;
export const TICKET_TOPICS = ["purchase_locked", "refund", "billing_other", "account_access", "account_deletion", "legal", "install", "other"] as const;
export type TicketBody = {
  sessionId?: string; reason: (typeof TICKET_REASONS)[number]; topic?: (typeof TICKET_TOPICS)[number];
  orderId?: string; note?: string; includeChat: boolean; reportId?: string;
};

const isShortId = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 200;

export function parseTicket(body: unknown): Parsed<TicketBody> {
  if (!exactKeys(body, ["reason", "includeChat"], ["sessionId", "topic", "orderId", "note", "reportId"])) return fail("bad_body");
  const b = body as Record<string, unknown>;
  if (!(TICKET_REASONS as readonly unknown[]).includes(b.reason)) return fail("bad_body");
  if (b.topic !== undefined && !(TICKET_TOPICS as readonly unknown[]).includes(b.topic)) return fail("bad_body");
  if (typeof b.includeChat !== "boolean") return fail("bad_body");
  if (b.sessionId !== undefined && !isShortId(b.sessionId)) return fail("bad_body");
  if (b.reportId !== undefined && !isShortId(b.reportId)) return fail("bad_body");
  if (b.orderId !== undefined && (typeof b.orderId !== "string" || !ORDER_ID_PATTERN.test(b.orderId))) return fail("bad_body");
  if (b.note !== undefined && (typeof b.note !== "string" || [...b.note].length > 2000)) return fail("bad_body");
  return { ok: true, value: b as TicketBody };
}

export function parseFeedback(body: unknown): Parsed<{ sessionId: string; turnId: string; value: "solved" | "stuck" }> {
  if (!exactKeys(body, ["sessionId", "turnId", "value"], [])) return fail("bad_body");
  if (!isShortId(body.sessionId) || !isShortId(body.turnId)) return fail("bad_body");
  if (body.value !== "solved" && body.value !== "stuck") return fail("bad_body");
  return { ok: true, value: body as { sessionId: string; turnId: string; value: "solved" | "stuck" } };
}

export function parseReportAttach(body: unknown): Parsed<{ sessionId: string; reportId: string }> {
  if (!exactKeys(body, ["sessionId", "reportId"], [])) return fail("bad_body");
  if (!isShortId(body.sessionId) || !isShortId(body.reportId)) return fail("bad_body");
  return { ok: true, value: body as { sessionId: string; reportId: string } };
}

export function parseRedeem(body: unknown): Parsed<{ code: string; verifier: string }> {
  if (!exactKeys(body, ["code", "verifier"], [])) return fail("bad_body");
  const ok = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(v);
  if (!ok(body.code) || !ok(body.verifier)) return fail("bad_body");
  return { ok: true, value: body as { code: string; verifier: string } };
}

export function charsBucket(n: number): "<50" | "50-200" | "200-800" | "800+" {
  return n < 50 ? "<50" : n < 200 ? "50-200" : n < 800 ? "200-800" : "800+";
}
