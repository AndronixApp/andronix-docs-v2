// /eve/v1/* (4 routes, build plan 1.4): the Worker builds eve's body itself, adds x-eve-edge and
// the x-andronix-* headers, and passes eve's answers through. Any other /eve/* path → 404.

import { charsBucket, imagesHeader, mask, parseCancel, parseCreate, parseFollowup, withImageMarkers, type Entry } from "./body.ts";
import { imageAttachedEvent, imagesEnabledFor } from "./images.ts";
import { authenticate, chatEnabled, reportTransition, type Caller, type Ctx } from "./context.ts";
import type { TurnSignal } from "./limiter/core.ts";
import { chatIdFor, sha256Hex } from "./crypto.ts";
import { fail, readJson } from "./http.ts";
import { track } from "./clients.ts";
import type { Env } from "./env.ts";

const SESSION = /^\/eve\/v1\/session\/([^/]{1,200})(\/stream|\/cancel)?$/;
/** Query params the pinned useEveAgent sends on stream reads (eve 1.5.0 client/open-stream.js). */
const STREAM_PARAMS: Record<string, RegExp> = { startIndex: /^-?\d{1,9}$/, includeTailIndex: /^1$/, follow: /^false$/ };

/**
 * The pinned useEveAgent builds the POST body itself (exactly {message}, spike 2A.1), so the page
 * sends clientMsgId and entry as per-send headers, `x-andronix-client-msg-id` and
 * `x-andronix-entry` (A's C1 proposal). They're folded into the body before the 1.4 key check
 * and never forwarded: the Worker builds every x-andronix-* header toward eve itself.
 */
async function bodyWithHeaders(request: Request, keys: ("clientMsgId" | "entry" | "images")[]): Promise<unknown> {
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  const msgId = request.headers.get("x-andronix-client-msg-id");
  const entry = request.headers.get("x-andronix-entry");
  // image ids ride as a per-send header too (`x-andronix-images: id1,id2`), like clientMsgId
  const images = imagesHeader(request.headers.get("x-andronix-images"));
  if (keys.includes("clientMsgId") && msgId && b.clientMsgId === undefined) b.clientMsgId = msgId;
  if (keys.includes("entry") && entry && b.entry === undefined) b.entry = entry;
  if (keys.includes("images") && images && b.images === undefined) b.images = images;
  return b;
}

const surfaceFor = (entry: Entry) => (entry === "app_help" || entry === "app_install_failed" ? "app_webview" : "web");

async function eveHeaders(env: Env, request: Request, caller: Caller, entry: Entry, budget: "normal" | "degrade", sessionId?: string): Promise<Headers> {
  const h = new Headers();
  h.set("authorization", request.headers.get("authorization") ?? "");
  h.set("accept", request.headers.get("accept") ?? "*/*");
  h.set("x-eve-edge", env.EVE_EDGE_SECRET ?? "");
  if (env.EVE_BYPASS_HEADER) h.set("x-vercel-protection-bypass", env.EVE_BYPASS_HEADER);
  h.set("x-andronix-tier", caller.tier);
  h.set("x-andronix-budget", budget);
  h.set("x-andronix-entry", entry);
  h.set("x-andronix-surface", surfaceFor(entry));
  h.set("x-andronix-pid", caller.pid);
  if (sessionId) h.set("x-andronix-chat-id", await chatIdFor(sessionId));
  return h;
}

const PASS_HEADERS = ["content-type", "x-eve-session-id", "x-eve-stream-format", "x-eve-stream-tail-index", "x-eve-stream-version", "retry-after"];

function passthrough(res: Response, body: BodyInit | null = res.body): Response {
  const h = new Headers({ "cache-control": "no-store" });
  for (const k of PASS_HEADERS) { const v = res.headers.get(k); if (v !== null) h.set(k, v); }
  return new Response(body, { status: res.status, headers: h });
}

/** eve 5xx and network errors become `upstream`; eve 4xx pass through (the hook reads session_not_ready etc.). */
async function forward(env: Env, path: string, init: RequestInit): Promise<Response | null> {
  if (!env.EVE_ORIGIN) return null;
  try {
    const res = await fetch(env.EVE_ORIGIN.replace(/\/$/, "") + path, { ...init, redirect: "manual" });
    return res.status >= 500 ? null : res;
  } catch {
    return null;
  }
}

async function gate(ctx: Ctx, request: Request): Promise<Caller | Response> {
  if (!chatEnabled(ctx.env)) return fail("disabled", 3600);
  const caller = await authenticate(ctx, request);
  if ("error" in caller) return fail(caller.error);
  if (!caller.rollout) return fail("disabled", 86400);
  return caller;
}

function rateLimited(ctx: Ctx, caller: Caller, code: string, entry: Entry) {
  ctx.exec.waitUntil(track(ctx.env, { name: "chat_rate_limited", profileId: caller.pid, properties: { scope: code, tier: caller.tier, entry, surface: surfaceFor(entry) } }));
}

export async function handleEve(ctx: Ctx, request: Request, url: URL): Promise<Response> {
  const path = url.pathname;
  if (path === "/eve/v1/session" && request.method === "POST") return create(ctx, request);
  const m = SESSION.exec(path);
  if (!m) return new Response("Not found", { status: 404 });
  const sessionId = decodeURIComponent(m[1]);
  if (!m[2] && request.method === "POST") return followup(ctx, request, sessionId);
  if (m[2] === "/stream" && request.method === "GET") return stream(ctx, request, url, sessionId);
  if (m[2] === "/cancel" && request.method === "POST") return cancel(ctx, request, sessionId);
  return new Response("Not found", { status: 404 });
}

function deliveryIdOf(text: string): string | null {
  try { const j = JSON.parse(text); return typeof j.deliveryId === "string" && j.deliveryId ? j.deliveryId : null; } catch { return null; }
}

/** The original eve answer, for a repeat of the same (session, clientMsgId): no eve call, no turn. */
function replayed(r: { status: number; body: string; sessionId?: string }): Response {
  const h = new Headers({ "cache-control": "no-store", "content-type": "application/json", "x-andronix-replay": "1" });
  if (r.sessionId) h.set("x-eve-session-id", r.sessionId);
  return new Response(r.body, { status: r.status, headers: h });
}

async function create(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseCreate(await bodyWithHeaders(request, ["clientMsgId", "entry", "images"]), ctx.limits.maxChars, ctx.limits.images.perMessage);
  if (!parsed.ok) return fail(parsed.code);
  const { message, clientMsgId, entry, images } = parsed.value;
  if (images.length && !imagesEnabledFor(ctx, caller)) return fail("image_limit", 86400);
  const admit = await ctx.limiter.call("admitCreate", caller.who, clientMsgId, images);
  if (!admit.ok) { if (admit.code !== "turn_running") rateLimited(ctx, caller, admit.code, entry); return fail(admit.code, admit.retryAfter); }
  if (admit.kind === "replay") return replayed(admit);
  reportTransition(ctx, admit.transition);
  const release = async () => {
    if (clientMsgId) await ctx.limiter.call("releaseDedupe", caller.who.uid, "create", clientMsgId);
    if (images.length) await ctx.limiter.call("releaseImages", images);
  };
  const masked = mask(message);
  const body: Record<string, string> = { message: withImageMarkers(masked.text, images) };
  // eve's create takes operationId for retry-safe creates (not idempotencyKey; spike C2)
  if (clientMsgId) body.operationId = await sha256Hex(`${caller.who.uid}:${clientMsgId}`);
  const headers = await eveHeaders(ctx.env, request, caller, entry, admit.budget);
  headers.set("content-type", "application/json");
  const res = await forward(ctx.env, "/eve/v1/session", { method: "POST", headers, body: JSON.stringify(body) });
  if (!res) { await release(); return fail("upstream"); }
  if (!res.ok) { await release(); return passthrough(res); }
  const text = await res.text();
  let sessionId = res.headers.get("x-eve-session-id")?.trim() ?? "";
  try { const j = JSON.parse(text); if (typeof j.sessionId === "string") sessionId = j.sessionId; } catch {}
  if (!sessionId) { await release(); return fail("upstream"); }
  await ctx.limiter.call("bindSession", caller.who.uid, sessionId, entry);
  if (images.length) {
    const bytes = await ctx.limiter.call("attachImages", caller.who.uid, sessionId, images);
    imageAttachedEvent(ctx, caller, images.length, bytes, entry, surfaceFor(entry));
  }
  await ctx.limiter.call("turnAccepted", sessionId, deliveryIdOf(text));
  if (clientMsgId) await ctx.limiter.call("recordResult", caller.who.uid, "create", clientMsgId, res.status, text, sessionId);
  ctx.exec.waitUntil(track(ctx.env, {
    name: "chat_message_sent", profileId: caller.pid,
    properties: { chat_id: await chatIdFor(sessionId), tier: caller.tier, turn: 1, chars_bucket: charsBucket([...message].length), masked: masked.masked, entry, surface: surfaceFor(entry) },
  }));
  return passthrough(res, text);
}

async function followup(ctx: Ctx, request: Request, sessionId: string): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseFollowup(await bodyWithHeaders(request, ["clientMsgId", "images"]), ctx.limits.maxChars, ctx.limits.images.perMessage);
  if (!parsed.ok) return fail(parsed.code);
  const { message, clientMsgId, images } = parsed.value;
  if (images.length && !imagesEnabledFor(ctx, caller)) return fail("image_limit", 86400);
  const admit = await ctx.limiter.call("admitFollowup", caller.who, sessionId, clientMsgId, images);
  if (!admit.ok) {
    if (admit.code !== "not_owner" && admit.code !== "turn_running" && admit.code !== "chat_full") {
      const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
      rateLimited(ctx, caller, admit.code, s.ok ? s.entry : "docs");
    }
    return fail(admit.code, admit.retryAfter);
  }
  if (admit.kind === "replay") return replayed({ ...admit, sessionId });
  reportTransition(ctx, admit.transition);
  const masked = mask(message);
  const body: Record<string, string> = { message: withImageMarkers(masked.text, images) };
  if (clientMsgId) body.idempotencyKey = await sha256Hex(`${caller.who.uid}:${clientMsgId}`);
  const headers = await eveHeaders(ctx.env, request, caller, admit.entry, admit.budget, sessionId);
  headers.set("content-type", "application/json");
  const res = await forward(ctx.env, `/eve/v1/session/${encodeURIComponent(sessionId)}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res || !res.ok) {
    await ctx.limiter.call("turnRejected", sessionId);
    if (clientMsgId) await ctx.limiter.call("releaseDedupe", caller.who.uid, sessionId, clientMsgId);
    if (images.length) await ctx.limiter.call("releaseImages", images);
    return res ? passthrough(res) : fail("upstream");
  }
  const text = await res.text();
  if (images.length) {
    const bytes = await ctx.limiter.call("attachImages", caller.who.uid, sessionId, images);
    imageAttachedEvent(ctx, caller, images.length, bytes, admit.entry, surfaceFor(admit.entry));
  }
  await ctx.limiter.call("turnAccepted", sessionId, deliveryIdOf(text));
  if (clientMsgId) await ctx.limiter.call("recordResult", caller.who.uid, sessionId, clientMsgId, res.status, text, sessionId);
  ctx.exec.waitUntil(track(ctx.env, {
    name: "chat_message_sent", profileId: caller.pid,
    properties: { chat_id: await chatIdFor(sessionId), tier: caller.tier, turn: admit.turn, chars_bucket: charsBucket([...message].length), masked: masked.masked, entry: admit.entry, surface: surfaceFor(admit.entry) },
  }));
  return passthrough(res, text);
}

async function cancel(ctx: Ctx, request: Request, sessionId: string): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseCancel(await readJson(request));
  if (!parsed.ok) return fail(parsed.code);
  const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
  if (!s.ok) return fail(s.code);
  const headers = await eveHeaders(ctx.env, request, caller, s.entry, "normal", sessionId);
  headers.set("content-type", "application/json");
  const res = await forward(ctx.env, `/eve/v1/session/${encodeURIComponent(sessionId)}/cancel`, { method: "POST", headers, body: JSON.stringify(parsed.value) });
  if (!res) return fail("upstream");
  if (res.ok) await ctx.limiter.call("turnEnded", sessionId, false);
  return passthrough(res);
}

async function stream(ctx: Ctx, request: Request, url: URL, sessionId: string): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  for (const [k, v] of url.searchParams) if (!STREAM_PARAMS[k] || !STREAM_PARAMS[k].test(v)) return fail("bad_body");
  const lease = await ctx.limiter.call("openStream", caller.who.uid, sessionId);
  if (!lease.ok) {
    if (lease.code === "streams") {
      const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
      rateLimited(ctx, caller, "streams", s.ok ? s.entry : "docs");
    }
    return fail(lease.code, lease.retryAfter);
  }
  const release = () => ctx.limiter.call("closeStream", caller.who.uid, lease.leaseId);
  const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
  const entry = s.ok ? s.entry : "docs";
  const headers = await eveHeaders(ctx.env, request, caller, entry, "normal", sessionId);
  const res = await forward(ctx.env, `/eve/v1/session/${encodeURIComponent(sessionId)}/stream${url.search}`, { method: "GET", headers, signal: request.signal });
  if (!res || !res.ok || !res.body) {
    ctx.exec.waitUntil(release());
    return res ? passthrough(res) : fail("upstream");
  }
  // signals go to the DO in stream order
  let chain: Promise<unknown> = Promise.resolve();
  const { readable, done } = sniffTurns(res.body, (sig) => { chain = chain.then(() => ctx.limiter.call("turnSignal", sessionId, sig)).catch(() => {}); });
  ctx.exec.waitUntil(done.then(() => chain));
  // The pump runs whether or not the client reads, so the lease is released when eve ends the
  // stream (its 60 s lease) or the client goes away; the 90 s lease TTL covers anything else.
  ctx.exec.waitUntil(done.finally(release));
  return passthrough(res, readable);
}

/**
 * Passes NDJSON through unchanged while reading the lines that matter to turn_running:
 * turn.started (deliveryId → turnId), turn.settled / turn.paused (turnId, line time) and
 * session.ended. The DO decides whether a line is about the running turn (QA-2 #8).
 */
export function sniffTurns(body: ReadableStream<Uint8Array>, onSignal: (sig: TurnSignal) => void): { readable: ReadableStream<Uint8Array>; done: Promise<void> } {
  const decoder = new TextDecoder();
  let buf = "";
  const scan = (line: string) => {
    if (!line.includes("turn.") && !line.includes("session.ended")) return;
    try {
      const v = JSON.parse(line) as { at?: string; facts?: { type?: string; data?: Record<string, any> }[]; progress?: { type?: string } };
      const at = Date.parse(v.at ?? "") || 0;
      for (const f of v.facts ?? []) {
        if (f.type === "turn.started" && typeof f.data?.turnId === "string" && typeof f.data?.cause?.deliveryId === "string") {
          onSignal({ kind: "started", deliveryId: f.data.cause.deliveryId, turnId: f.data.turnId });
        } else if ((f.type === "turn.settled" || f.type === "turn.paused") && typeof f.data?.turnId === "string") {
          onSignal({ kind: "settled", turnId: f.data.turnId, at });
        } else if (f.type === "session.ended") {
          onSignal({ kind: "ended" });
        }
      }
    } catch {}
  };
  const t = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buf += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { scan(buf.slice(0, i)); buf = buf.slice(i + 1); }
      if (buf.length > 1_000_000) buf = "";
    },
    flush() { if (buf) scan(buf); },
  }, { highWaterMark: 64 }, { highWaterMark: 64 });
  const done = body.pipeTo(t.writable).catch(() => {});
  return { readable: t.readable, done };
}

export const _test = { surfaceFor, STREAM_PARAMS };
