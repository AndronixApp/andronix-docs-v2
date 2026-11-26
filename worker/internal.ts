// /chat-api/internal/* (build plan 1.5): eve → usage, report, budget; products-api → erase.

import { reportTransition, type Ctx } from "./context.ts";
import { bearerMatches, pidFor, safeEqual } from "./crypto.ts";
import { deskReport, opsNotify } from "./clients.ts";
import { fail, json, noContent, readJson } from "./http.ts";
import { eraseImagePrefix, internalImage } from "./images.ts";

const isStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export async function handleInternal(ctx: Ctx, request: Request, url: URL): Promise<Response> {
  const p = url.pathname;
  if (p === "/chat-api/internal/erase") {
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    if (!(await bearerMatches(request.headers.get("authorization"), ctx.env.CHAT_SERVICE_SECRET))) return fail("auth");
    return erase(ctx, request);
  }
  if (!(await safeEqual(request.headers.get("x-chat-internal"), ctx.env.CHAT_INTERNAL_SECRET))) return fail("auth");
  if (p === "/chat-api/internal/usage" && request.method === "POST") return usage(ctx, request);
  if (p === "/chat-api/internal/report" && request.method === "POST") return report(ctx, request);
  if (p === "/chat-api/internal/budget" && request.method === "GET") return json(await ctx.limiter.call("budgetReport"));
  if (p === "/chat-api/internal/budget" && request.method === "POST") return floor(ctx, request);
  if (p === "/chat-api/internal/strike" && request.method === "POST") return strike(ctx, request);
  if (p === "/chat-api/internal/image" && request.method === "POST") return internalImage(ctx, request);
  return new Response("Not found", { status: 404 });
}

/**
 * POST /chat-api/internal/usage (contract/internal.ts, QA-1 S2): one call per provider call.
 * `costMicros` is null when the AI Gateway's cost is unknown; the Worker then counts eve's
 * `estimatedCostMicros` ceiling. Exact key set; ints ≥ 0.
 */
const USAGE_KEYS = ["generationId", "uid", "sessionId", "turnId", "model", "inputTokens", "outputTokens", "cachedTokens", "costMicros", "estimatedCostMicros", "outcome"];
const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

async function usage(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || Object.keys(b).some((k) => !USAGE_KEYS.includes(k)) || USAGE_KEYS.some((k) => !(k in b))) return fail("bad_body");
  if (!isStr(b.generationId) || !isStr(b.uid, 128) || !isStr(b.sessionId, 128) || !isStr(b.turnId, 64) || !isStr(b.model, 120)) return fail("bad_body");
  if (!isInt(b.inputTokens) || !isInt(b.outputTokens) || !isInt(b.cachedTokens) || !isInt(b.estimatedCostMicros)) return fail("bad_body");
  if (b.costMicros !== null && !isInt(b.costMicros)) return fail("bad_body");
  if (b.outcome !== "finished" && b.outcome !== "aborted" && b.outcome !== "error") return fail("bad_body");
  const costMicros = (b.costMicros as number | null) ?? (b.estimatedCostMicros as number);
  const r = await ctx.limiter.call("usage", { generationId: b.generationId, uid: b.uid, costMicros });
  reportTransition(ctx, r.transition);
  return noContent();
}

async function report(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isStr(b.uid, 128) || !isStr(b.sessionId)) return fail("bad_body");
  const reportId = await ctx.limiter.call("boundReport", b.uid, b.sessionId);
  if (!reportId) return json({ attached: false });
  const r = await deskReport(ctx.env, reportId, b.uid);
  return json(r ? { attached: true, ...r } : { attached: false });
}

async function floor(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isNum(b.monthSpendMicrosFloor)) return fail("bad_body");
  reportTransition(ctx, await ctx.limiter.call("setFloor", b.monthSpendMicrosFloor));
  return noContent();
}

/**
 * Account deletion (plan 1.5; eve side: andronix-support-agent contract/erase.md).
 * 1. Tombstone the uid at once: tokens issued before now get 401 for an hour.
 * 2. Ask eve to end the uid's sessions: POST /eve/v1/andronix/erase {pid, sessionIds}, with
 *    x-eve-edge + x-chat-internal. eve ends only sessions whose creator hashes to pid.
 * 3. Only after eve answers 200 does the DO forget the uid (counters, sessions, bindings).
 *    eve 502 / unreachable → 502 here, nothing forgotten, so products-api keeps the uid queued
 *    and the next sweep retries with the same session list.
 */
async function erase(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isStr(b.uid, 128)) return fail("bad_body");
  const uid = b.uid;
  await ctx.limiter.call("tombstone", uid);
  const sessionIds = (await ctx.limiter.call("sessionsOf", uid)).slice(-200);
  if (sessionIds.length && ctx.env.EVE_ORIGIN) {
    const ok = await eveErase(ctx, await pidFor(uid), sessionIds);
    if (!ok) return fail("upstream");
  }
  await ctx.limiter.call("erase", uid);
  // the DO's erase queues the uid's known images; the prefix sweep catches anything else
  try { await eraseImagePrefix(ctx, await pidFor(uid)); } catch { return fail("upstream"); }
  return noContent();
}

async function eveErase(ctx: Ctx, pid: string, sessionIds: string[]): Promise<boolean> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-eve-edge": ctx.env.EVE_EDGE_SECRET ?? "",
    "x-chat-internal": ctx.env.CHAT_INTERNAL_SECRET ?? "",
  };
  if (ctx.env.EVE_BYPASS_HEADER) headers["x-vercel-protection-bypass"] = ctx.env.EVE_BYPASS_HEADER;
  try {
    const res = await fetch(`${ctx.env.EVE_ORIGIN!.replace(/\/$/, "")}/eve/v1/andronix/erase`, {
      method: "POST", headers, body: JSON.stringify({ pid, sessionIds }), signal: AbortSignal.timeout(20_000), redirect: "manual",
    });
    if (res.status !== 200) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean; results?: { result?: string }[] } | null;
    return !!body?.ok && !(body.results ?? []).some((r) => r.result === "failed");
  } catch {
    return false;
  }
}

const STRIKE_REASONS = ["offtopic", "jailbreak", "harmful"] as const;

/**
 * eve's turn.settled hook reports a refused turn (guardrails §2):
 * {uid, sessionId, turnId, reason: offtopic | jailbreak | harmful}, de-duplicated on (sessionId, turnId).
 * Answers 204. Reaching the longest step posts once to the ops
 * webhook, with the pid only.
 */
async function strike(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isStr(b.uid, 128) || !isStr(b.sessionId) || !isStr(b.turnId) || !(STRIKE_REASONS as readonly unknown[]).includes(b.reason)) return fail("bad_body");
  if (Object.keys(b).some((k) => !["uid", "sessionId", "turnId", "reason"].includes(k))) return fail("bad_body");
  const r = await ctx.limiter.call("strike", b.uid, b.sessionId, b.turnId, b.reason as (typeof STRIKE_REASONS)[number]);
  if ("ok" in r) return fail(r.code);
  if (r.longest) {
    const pid = await pidFor(b.uid);
    ctx.exec.waitUntil(opsNotify(ctx.env, `Support chat: account ${pid} reached ${r.total} strike points in 24 h; paused for 24 h.`));
  }
  return noContent(); // contract: 204 (A-guardrails.md)
}
