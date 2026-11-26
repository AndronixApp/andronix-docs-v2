// /chat-api/* public routes (build plan 1.4): me, redeem, report-attach, ticket, feedback.

import { cutUtf16, parseFeedback, parseRedeem, parseReportAttach, parseTicket, type Entry } from "./body.ts";
import { authenticate, chatEnabled, type Caller, type Ctx } from "./context.ts";
import { chatIdFor } from "./crypto.ts";
import { fail, json, noContent, readJson, clientIp } from "./http.ts";
import { deskHandoff, deskReport, redeemHandoff, track } from "./clients.ts";

const surfaceFor = (entry: Entry) => (entry === "app_help" || entry === "app_install_failed" ? "app_webview" : "web");

export async function handleChatApi(ctx: Ctx, request: Request, url: URL): Promise<Response> {
  const p = url.pathname;
  if (p === "/chat-api/me" && request.method === "GET") return me(ctx, request);
  if (p === "/chat-api/redeem" && request.method === "POST") return redeem(ctx, request);
  if (p === "/chat-api/report-attach" && request.method === "POST") return reportAttach(ctx, request);
  if (p === "/chat-api/ticket" && request.method === "POST") return ticket(ctx, request);
  if (p === "/chat-api/feedback" && request.method === "POST") return feedback(ctx, request);
  if (p === "/chat-api/csp-report" && request.method === "POST") return cspReport(request);
  return new Response("Not found", { status: 404 });
}

async function signedIn(ctx: Ctx, request: Request, opts: { rollout: boolean } = { rollout: true }): Promise<Caller | Response> {
  if (!chatEnabled(ctx.env)) return fail("disabled", 3600);
  const caller = await authenticate(ctx, request);
  if ("error" in caller) return fail(caller.error);
  // tickets, feedback and report-attach follow the rollout like the chat itself (QA-1 S4);
  // only /me answers outside it, so the page can say the assistant isn't open yet
  if (opts.rollout && !caller.rollout) return fail("disabled", 86400);
  return caller;
}

async function me(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await signedIn(ctx, request, { rollout: false });
  if (caller instanceof Response) return caller;
  const m = await ctx.limiter.call("me", caller.who);
  return json({
    tier: caller.tier,
    pid: caller.pid,
    verified: caller.principal.emailVerified,
    newAccount: caller.newAccount,
    limits: { minute: m.minute, day: m.day, month: m.month, costDay: m.costDay },
    budget: m.budget,
    cooldownUntil: m.cooldownUntil,
    rollout: caller.rollout,
  });
}

async function redeem(ctx: Ctx, request: Request): Promise<Response> {
  if (!chatEnabled(ctx.env)) return fail("disabled", 3600);
  const ip = await ctx.limiter.call("admitRedeem", clientIp(request));
  if (!ip.ok) return fail(ip.code, ip.retryAfter);
  const parsed = parseRedeem(await readJson(request, 1024));
  if (!parsed.ok) return fail(parsed.code);
  const r = await redeemHandoff(ctx.env, parsed.value.code, parsed.value.verifier);
  if (!r.ok) {
    // products-api codes (code_unknown, code_used, code_expired, verifier_mismatch) pass through with their status
    if (r.status === 502) return fail("upstream");
    return json({ ok: false, code: r.code, error: "This chat link can't be used. Open the chat from the app again." }, r.status);
  }
  return json({ customToken: r.customToken, entry: r.entry, ...(r.reportId ? { reportId: r.reportId } : {}) });
}

async function reportAttach(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await signedIn(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseReportAttach(await readJson(request));
  if (!parsed.ok) return fail(parsed.code);
  const { sessionId, reportId } = parsed.value;
  const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
  if (!s.ok) return fail(s.code);
  const chatId = await chatIdFor(sessionId);
  // desk chat-report must answer 200 for this uid: the only ownership check (1.4)
  const report = await deskReport(ctx.env, reportId, caller.who.uid);
  const props = { chat_id: chatId, via: s.entry === "app_install_failed" ? "install_failed" : "assistant_ask", entry: s.entry, surface: surfaceFor(s.entry) };
  if (!report) {
    ctx.exec.waitUntil(track(ctx.env, { name: "chat_report_attached", profileId: caller.pid, properties: { ...props, ok: false } }));
    return fail("not_owner");
  }
  await ctx.limiter.call("bindReport", caller.who.uid, sessionId, reportId);
  ctx.exec.waitUntil(track(ctx.env, { name: "chat_report_attached", profileId: caller.pid, properties: { ...props, ok: true } }));
  return json({ ok: true });
}

async function feedback(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await signedIn(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseFeedback(await readJson(request));
  if (!parsed.ok) return fail(parsed.code);
  const { sessionId, turnId, value } = parsed.value;
  const r = await ctx.limiter.call("feedback", caller.who.uid, sessionId, turnId);
  if (!r.ok) return fail(r.code);
  if (r.first) {
    const s = await ctx.limiter.call("session", caller.who.uid, sessionId);
    const entry = s.ok ? s.entry : "docs";
    ctx.exec.waitUntil(track(ctx.env, { name: "chat_feedback", profileId: caller.pid, properties: { chat_id: await chatIdFor(sessionId), value, turn: r.turns, entry, surface: surfaceFor(entry) } }));
  }
  return noContent();
}

// ---- tickets ----

type Line = { at?: string; facts?: { type?: string; data?: Record<string, unknown> }[] };

/** Builds the transcript from eve's stream lines: user parts and assistant replies, last 24, each ≤4,000. */
export function transcriptFromNdjson(text: string): { role: "user" | "assistant"; text: string; at: string }[] {
  const out: { role: "user" | "assistant"; text: string; at: string }[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let line: Line;
    try { line = JSON.parse(raw); } catch { continue; }
    for (const f of line.facts ?? []) {
      const d = f.data ?? {};
      if (f.type === "delivery.consumed" && Array.isArray(d.parts)) {
        // eve 1.5.0 user parts are {kind: "text", text}
        const t = (d.parts as { kind?: string; type?: string; text?: string }[]).filter((p) => (p?.kind ?? p?.type) === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
        if (t) out.push({ role: "user", text: t, at: line.at ?? "" });
      } else if (f.type === "content.completed" && d.kind === "text" && (d.phase === "reply" || d.phase === "narration")) {
        // narration carries the money gate's fixed reply (spike C3)
        const t = typeof d.value === "string" ? d.value : typeof d.fallbackText === "string" ? d.fallbackText : "";
        if (t) out.push({ role: "assistant", text: t, at: line.at ?? "" });
      }
    }
  }
  return out.slice(-24).map((e) => ({ ...e, text: cutUtf16(e.text, 4000) }));
}

async function fetchTranscript(ctx: Ctx, request: Request, sessionId: string): Promise<{ role: string; text: string; at: string }[] | null> {
  if (!ctx.env.EVE_ORIGIN) return null;
  const headers = new Headers({ authorization: request.headers.get("authorization") ?? "", "x-eve-edge": ctx.env.EVE_EDGE_SECRET ?? "" });
  if (ctx.env.EVE_BYPASS_HEADER) headers.set("x-vercel-protection-bypass", ctx.env.EVE_BYPASS_HEADER);
  try {
    const res = await fetch(`${ctx.env.EVE_ORIGIN.replace(/\/$/, "")}/eve/v1/session/${encodeURIComponent(sessionId)}/stream?follow=false`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null; // 410 and others → transcript_expired
    const t = transcriptFromNdjson(await res.text());
    return t.length ? t : null;
  } catch {
    return null;
  }
}

async function ticket(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await signedIn(ctx, request);
  if (caller instanceof Response) return caller;
  const parsed = parseTicket(await readJson(request));
  if (!parsed.ok) return fail(parsed.code);
  // The desk replies by email; an account without one can't get a reply (QA-1 S11).
  if (!caller.principal.email) return json({ ok: false, code: "bad_body", error: "Your account has no email address, so our team can't reply. Use Report a problem in the app." }, 400);
  const b = parsed.value;
  let entry: Entry = "docs";
  let boundReport: string | null = null;
  if (b.sessionId) {
    const s = await ctx.limiter.call("session", caller.who.uid, b.sessionId);
    if (!s.ok) return fail(s.code);
    entry = s.entry;
    boundReport = s.reportId;
  }
  const scope = b.sessionId ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = `${caller.who.uid}:${scope}:${b.reason}`;
  const admit = await ctx.limiter.call("admitTicket", caller.who.uid, idempotencyKey);
  if (!admit.ok) return fail(admit.code, admit.retryAfter);
  // A reportId in the body counts only if it's the one bound to this session (bound after the desk's ownership check).
  const reportId = b.reportId && b.reportId === boundReport ? b.reportId : boundReport ?? undefined;
  let transcript: { role: string; text: string; at: string }[] | undefined;
  let transcriptExpired = false;
  if (b.includeChat && b.sessionId) {
    const t = await fetchTranscript(ctx, request, b.sessionId);
    if (t) transcript = t; else transcriptExpired = true;
  }
  const res = await deskHandoff(ctx.env, {
    idempotencyKey, uid: caller.who.uid, email: caller.principal.email ?? "", emailVerified: caller.principal.emailVerified,
    reason: b.reason, topic: b.topic, reportId, orderId: b.orderId, note: b.note, transcript, pid: caller.pid, entry,
  });
  const chatId = b.sessionId ? await chatIdFor(b.sessionId) : undefined;
  ctx.exec.waitUntil(track(ctx.env, {
    name: "chat_handoff", profileId: caller.pid,
    properties: {
      ...(chatId ? { chat_id: chatId } : {}), reason: b.reason, with_report: !!reportId, with_chat: !!transcript,
      transcript_expired: transcriptExpired, verified: caller.principal.emailVerified, ok: !!res, entry, surface: surfaceFor(entry),
    },
  }));
  if (!res) {
    if (!admit.repeat) await ctx.limiter.call("releaseTicket", caller.who.uid, idempotencyKey);
    return fail("upstream");
  }
  return json({ ticketRef: res.ticketRef });
}

/**
 * CSP violation reports from /chat (QA-1 S13). Logged to Workers observability with only the
 * directive and the blocked origin: no page URL, no path or query, nothing the user typed.
 */
async function cspReport(request: Request): Promise<Response> {
  const text = (await request.text()).slice(0, 8192);
  try {
    const raw = JSON.parse(text) as unknown;
    const items = Array.isArray(raw) ? raw.map((r) => (r as { body?: unknown }).body) : [(raw as { "csp-report"?: unknown })["csp-report"]];
    for (const r of items.slice(0, 5)) {
      const o = (r ?? {}) as Record<string, unknown>;
      const directive = String(o["effective-directive"] ?? o.effectiveDirective ?? o["violated-directive"] ?? "").split(" ")[0].slice(0, 40);
      const blocked = String(o["blocked-uri"] ?? o.blockedURL ?? "");
      let origin = blocked.slice(0, 20);
      try { origin = new URL(blocked).origin; } catch {}
      console.log("chat csp violation", JSON.stringify({ directive, blocked: origin }));
    }
  } catch {}
  return noContent();
}
