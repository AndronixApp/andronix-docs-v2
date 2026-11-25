// /chat-api/internal/* (build plan 1.5): eve → usage, report, budget; products-api → erase.

import { reportTransition, type Ctx } from "./context.ts";
import { bearerMatches, safeEqual } from "./crypto.ts";
import { deskReport } from "./clients.ts";
import { fail, json, noContent, readJson } from "./http.ts";

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
  return new Response("Not found", { status: 404 });
}

async function usage(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isStr(b.generationId) || !isStr(b.uid, 128) || !isStr(b.sessionId) || !isNum(b.costMicros)) return fail("bad_body");
  for (const k of ["inputTokens", "outputTokens", "cachedTokens"]) if (b[k] !== undefined && !isNum(b[k])) return fail("bad_body");
  const r = await ctx.limiter.call("usage", { generationId: b.generationId, uid: b.uid, costMicros: b.costMicros });
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

async function erase(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!b || !isStr(b.uid, 128)) return fail("bad_body");
  const sessions = await ctx.limiter.call("erase", b.uid);
  // End the uid's open eve sessions (best effort; eve's idle end and retention cover the rest).
  if (ctx.env.EVE_ORIGIN && sessions.length) {
    const origin = ctx.env.EVE_ORIGIN.replace(/\/$/, "");
    const headers: Record<string, string> = { "content-type": "application/json", "x-eve-edge": ctx.env.EVE_EDGE_SECRET ?? "", "x-andronix-erase": "1" };
    if (ctx.env.EVE_BYPASS_HEADER) headers["x-vercel-protection-bypass"] = ctx.env.EVE_BYPASS_HEADER;
    ctx.exec.waitUntil(Promise.allSettled(sessions.map((id) =>
      fetch(`${origin}/eve/v1/session/${encodeURIComponent(id)}/end`, { method: "POST", headers, body: JSON.stringify({ reason: "account_deleted" }), signal: AbortSignal.timeout(10_000) }),
    )));
  }
  return noContent();
}
