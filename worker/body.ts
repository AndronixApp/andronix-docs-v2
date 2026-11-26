// Body rules for /eve/* POSTs and the masking of chat messages (build plan 1.4).
// The Worker builds the eve body itself; the client can't set eve's other fields.

import type { ErrorCode } from "../lib/chat-contract/http/http-errors.ts";
import { MARKER_LIKE } from "../lib/chat-contract/images.ts";

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

/** The page's text for an image-only message (eve's client won't send an empty message); never forwarded. */
export const IMAGE_ONLY_TEXT = "\u2063";
const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * User-typed image markers are removed (only the Worker adds them). Empty text is allowed when
 * the message carries images (image-only messages, lead decision 6).
 */
function message(v: unknown, maxChars: number, hasImages = false): Parsed<string> {
  if (typeof v !== "string") return fail("bad_body");
  const t = v.replaceAll(IMAGE_ONLY_TEXT, "").replace(MARKER_LIKE, "").trim();
  if (t.length === 0 && !hasImages) return fail("bad_body");
  if ([...t].length > maxChars) return fail("message_too_long");
  return { ok: true, value: t };
}

/** ≤ perMessage distinct lowercase uuid-v4 image ids (folded from the `x-andronix-images` header). */
function imageIds(v: unknown, perMessage: number): Parsed<string[]> {
  if (v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v) || v.length === 0) return fail("bad_body");
  if (v.length > perMessage) return fail("image_limit");
  if (!v.every((x) => typeof x === "string" && IMAGE_ID.test(x))) return fail("bad_body");
  if (new Set(v).size !== v.length) return fail("bad_body");
  return { ok: true, value: v as string[] };
}

/** `x-andronix-images: id1,id2` → array; undefined when absent or empty. */
export function imagesHeader(h: string | null): string[] | undefined {
  if (!h || !h.trim()) return undefined;
  return h.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function clientMsgId(v: unknown): Parsed<string | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  return typeof v === "string" && UUID.test(v) ? { ok: true, value: v.toLowerCase() } : fail("bad_body");
}

export type CreateBody = { message: string; clientMsgId?: string; entry: Entry; images: string[] };
export type FollowupBody = { message: string; clientMsgId?: string; images: string[] };
export type CancelBody = { turnId?: string };

export function parseCreate(body: unknown, maxChars: number, perMessage = 2): Parsed<CreateBody> {
  if (!exactKeys(body, ["message", "entry"], ["clientMsgId", "images"])) return fail("bad_body");
  if (!isEntry(body.entry)) return fail("bad_body");
  const i = imageIds(body.images, perMessage);
  if (!i.ok) return i;
  const m = message(body.message, maxChars, i.value.length > 0);
  if (!m.ok) return m;
  const c = clientMsgId(body.clientMsgId);
  if (!c.ok) return c;
  return { ok: true, value: { message: m.value, clientMsgId: c.value, entry: body.entry, images: i.value } };
}

export function parseFollowup(body: unknown, maxChars: number, perMessage = 2): Parsed<FollowupBody> {
  if (!exactKeys(body, ["message"], ["clientMsgId", "images"])) return fail("bad_body");
  const i = imageIds(body.images, perMessage);
  if (!i.ok) return i;
  const m = message(body.message, maxChars, i.value.length > 0);
  if (!m.ok) return m;
  const c = clientMsgId(body.clientMsgId);
  if (!c.ok) return c;
  return { ok: true, value: { message: m.value, clientMsgId: c.value, images: i.value } };
}

/** The text eve gets: masked user text, then one marker per admitted image. */
export function withImageMarkers(masked: string, images: readonly string[]): string {
  const markers = images.map((id) => `[[img:${id}]]`).join("");
  return masked ? (markers ? `${masked}\n${markers}` : masked) : markers;
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
  /** Opt-in box "Attach my screenshots", off by default (lead decision 4). */
  includeImages?: boolean;
};

const isShortId = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 200;

export function parseTicket(body: unknown): Parsed<TicketBody> {
  if (!exactKeys(body, ["reason", "includeChat"], ["sessionId", "topic", "orderId", "note", "reportId", "includeImages"])) return fail("bad_body");
  const b = body as Record<string, unknown>;
  if (!(TICKET_REASONS as readonly unknown[]).includes(b.reason)) return fail("bad_body");
  if (b.topic !== undefined && !(TICKET_TOPICS as readonly unknown[]).includes(b.topic)) return fail("bad_body");
  if (typeof b.includeChat !== "boolean") return fail("bad_body");
  if (b.includeImages !== undefined && typeof b.includeImages !== "boolean") return fail("bad_body");
  if (b.sessionId !== undefined && !isShortId(b.sessionId)) return fail("bad_body");
  if (b.reportId !== undefined && !isShortId(b.reportId)) return fail("bad_body");
  if (b.orderId !== undefined && (typeof b.orderId !== "string" || !ORDER_ID_PATTERN.test(b.orderId))) return fail("bad_body");
  // UTF-16 units, the desk's unit (QA-1 S12)
  if (b.note !== undefined && (typeof b.note !== "string" || b.note.length > 2000)) return fail("bad_body");
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

/** Cuts to at most `max` UTF-16 units without splitting a surrogate pair (the desk counts UTF-16). */
export function cutUtf16(s: string, max: number): string {
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut;
}

export function charsBucket(n: number): "<50" | "50-200" | "200-800" | "800+" {
  return n < 50 ? "<50" : n < 200 ? "50-200" : n < 800 ? "200-800" : "800+";
}
