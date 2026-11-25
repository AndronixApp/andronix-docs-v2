// docs.andronix.app Worker. Runs only for run_worker_first paths (wrangler.toml):
//   /__/auth/*, /__/firebase/*  → Firebase sign-in helper proxy (no rate limit)
//   /chat-api/*                 → chat routes (ChatLimiter DO, products-api, desk)
//   /eve/v1/* (4 routes)        → eve on Vercel, Worker-built body
// Static pages never reach this script; anything else that does is served from ASSETS.

import { firebaseAuthProxy, isFirebaseAuthPath } from "./auth-proxy.ts";
import { makeCtx } from "./context.ts";
import { handleEve } from "./eve.ts";
import { handleChatApi } from "./chat.ts";
import { handleInternal } from "./internal.ts";
import { json } from "./http.ts";
import type { Env } from "./env.ts";

export { ChatLimiter } from "./limiter/do.ts";

export default {
  async fetch(request: Request, env: Env & { CHAT_DEV?: string }, exec: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;

    if (isFirebaseAuthPath(p)) return firebaseAuthProxy(request, env.FIREBASE_PROJECT_ID || "andronix-techriz");

    if (p.startsWith("/chat-api/") || p.startsWith("/eve/")) {
      const ctx = makeCtx(env, exec);
      try {
        if (p.startsWith("/chat-api/internal/")) return await handleInternal(ctx, request, url);
        if (p.startsWith("/chat-api/dev/") && env.CHAT_DEV === "1") return await dev(ctx, request, url);
        if (p.startsWith("/chat-api/")) return await handleChatApi(ctx, request, url);
        return await handleEve(ctx, request, url);
      } catch (e) {
        console.error("chat worker error", e instanceof Error ? e.name : "unknown");
        return json({ ok: false, code: "upstream", error: "Something went wrong. Try again." }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

/** Dev and preview only (CHAT_DEV=1): move the DO clock and run the alarm sweep, for expiry tests. */
async function dev(ctx: ReturnType<typeof makeCtx>, request: Request, url: URL): Promise<Response> {
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  if (url.pathname === "/chat-api/dev/advance") return json({ offsetMs: await ctx.limiter.devAdvance(Number(url.searchParams.get("ms") || 0)) });
  if (url.pathname === "/chat-api/dev/sweep") return json(await ctx.limiter.devSweep());
  return new Response("Not found", { status: 404 });
}
