// /eve/v1/* (4 routes, build plan 1.4): the Worker builds eve's body itself, adds x-eve-edge and
// the x-andronix-* headers, and passes eve's answers through. Any other /eve/* path → 404.

import { charsBucket, mask, parseCancel, parseCreate, parseFollowup, type Entry } from "./body.ts";
import { authenticate, chatEnabled, reportTransition, type Caller, type Ctx } from "./context.ts";
import { chatIdFor, sha256Hex } from "./crypto.ts";
import { fail, readJson } from "./http.ts";
import { track } from "./clients.ts";
import type { Env } from "./env.ts";

const SESSION = /^\/eve\/v1\/session\/([^/]{1,200})(\/stream|\/cancel)?$/;
/** Query params the pinned useEveAgent sends on stream reads (eve 1.5.0 client/open-stream.js). */
const STREAM_PARAMS: Record<string, RegExp> = { startIndex: /^-?\d{1,9}$/, includeTailIndex: /^1$/, follow: /^false$/ };
/** Set from the spike (2A.1-2): whether eve's create accepts idempotencyKey. Follow-ups always send it. */
const CREATE_SENDS_IDEMPOTENCY_KEY = false;

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

async function create(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseCreate(await readJson(request), ctx.limits.maxChars);
  if (!parsed.ok) return fail(parsed.code);
  const { message, clientMsgId, entry } = parsed.value;
  const admit = await ctx.limiter.call("admitCreate", caller.who, clientMsgId);
  if (!admit.ok) { rateLimited(ctx, caller, admit.code, entry); return fail(admit.code, admit.retryAfter); }
  reportTransition(ctx, admit.transition);
  const masked = mask(message);
  const body: Record<string, string> = { message: masked.text };
  if (CREATE_SENDS_IDEMPOTENCY_KEY && clientMsgId) body.idempotencyKey = await sha256Hex(`${caller.who.uid}:${clientMsgId}`);
  const headers = await eveHeaders(ctx.env, request, caller, entry, admit.budget);
  headers.set("content-type", "application/json");
  const res = await forward(ctx.env, "/eve/v1/session", { method: "POST", headers, body: JSON.stringify(body) });
  if (!res) return fail("upstream");
  if (!res.ok) return passthrough(res);
  const text = await res.text();
  let sessionId = res.headers.get("x-eve-session-id")?.trim() ?? "";
  try { const j = JSON.parse(text); if (typeof j.sessionId === "string") sessionId = j.sessionId; } catch {}
  if (!sessionId) return fail("upstream");
  await ctx.limiter.call("bindSession", caller.who.uid, sessionId, entry);
  if (!admit.duplicate) {
    ctx.exec.waitUntil(track(ctx.env, {
      name: "chat_message_sent", profileId: caller.pid,
      properties: { chat_id: await chatIdFor(sessionId), tier: caller.tier, turn: 1, chars_bucket: charsBucket([...message].length), masked: masked.masked, entry, surface: surfaceFor(entry) },
    }));
  }
  return passthrough(res, text);
}

async function followup(ctx: Ctx, request: Request, sessionId: string): Promise<Response> {
  const caller = await gate(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseFollowup(await readJson(request), ctx.limits.maxChars);
  if (!parsed.ok) return fail(parsed.code);
  const { message, clientMsgId } = parsed.value;
  const admit = await ctx.limiter.call("admitFollowup", caller.who, sessionId, clientMsgId);
  if (!admit.ok) {
    if (admit.code !== "not_owner" && admit.code !== "turn_running" && admit.code !== "chat_full") {
      const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
      rateLimited(ctx, caller, admit.code, s.ok ? s.entry : "docs");
    }
    return fail(admit.code, admit.retryAfter);
  }
  reportTransition(ctx, admit.transition);
  const masked = mask(message);
  const body: Record<string, string> = { message: masked.text };
  if (clientMsgId) body.idempotencyKey = await sha256Hex(`${caller.who.uid}:${clientMsgId}`);
  const headers = await eveHeaders(ctx.env, request, caller, admit.entry, admit.budget, sessionId);
  headers.set("content-type", "application/json");
  const res = await forward(ctx.env, `/eve/v1/session/${encodeURIComponent(sessionId)}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res || !res.ok) {
    if (!admit.duplicate) await ctx.limiter.call("turnRejected", sessionId);
    return res ? passthrough(res) : fail("upstream");
  }
  if (!admit.duplicate) {
    ctx.exec.waitUntil(track(ctx.env, {
      name: "chat_message_sent", profileId: caller.pid,
      properties: { chat_id: await chatIdFor(sessionId), tier: caller.tier, turn: admit.turn, chars_bucket: charsBucket([...message].length), masked: masked.masked, entry: admit.entry, surface: surfaceFor(admit.entry) },
    }));
  }
  return passthrough(res);
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
  return passthrough(res, sniffTurns(res.body, {
    onTurnEnd: (ended) => ctx.exec.waitUntil(ctx.limiter.call("turnEnded", sessionId, ended)),
    onClose: () => ctx.exec.waitUntil(release()),
  }));
}

/**
 * Passes NDJSON through unchanged while watching for turn ends, so the DO can clear
 * `turn_running` (turn.settled / turn.paused) and mark ended sessions (session.ended).
 * Releases the stream lease when the body ends or the client goes away.
 */
export function sniffTurns(body: ReadableStream<Uint8Array>, on: { onTurnEnd: (sessionEnded: boolean) => void; onClose: () => void }): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let closed = false;
  const close = () => { if (!closed) { closed = true; on.onClose(); } };
  const scan = (line: string) => {
    if (!line.includes("turn.") && !line.includes("session.ended")) return;
    try {
      const v = JSON.parse(line) as { facts?: { type?: string }[]; progress?: { type?: string } };
      const types = [...(v.facts ?? []), ...(v.progress ? [v.progress] : [])].map((f) => f?.type);
      if (types.includes("session.ended")) on.onTurnEnd(true);
      else if (types.includes("turn.settled") || types.includes("turn.paused")) on.onTurnEnd(false);
    } catch {}
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { if (buf) scan(buf); close(); controller.close(); return; }
        controller.enqueue(value);
        buf += decoder.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) { scan(buf.slice(0, i)); buf = buf.slice(i + 1); }
        if (buf.length > 1_000_000) buf = "";
      } catch (e) {
        close();
        controller.error(e);
      }
    },
    cancel(reason) { close(); return reader.cancel(reason); },
  });
}

export const _test = { surfaceFor, STREAM_PARAMS };
