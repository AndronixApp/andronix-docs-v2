// Per-request context: the limiter stub, the signed-in caller and their tier.

import type { LimiterRpc } from "./limiter/do.ts";
import type { BudgetTransition, Who } from "./limiter/core.ts";
import { inRollout, parseLimits, parseRollout, type Env, type Limits, type Tier } from "./env.ts";
import { verifyIdToken, type Principal } from "./token.ts";
import { fetchAccount, opsNotify, track } from "./clients.ts";
import { pidFor } from "./crypto.ts";
import { clientIp } from "./http.ts";
import type { ErrorCode } from "../lib/chat-contract/http/http-errors.ts";

export interface Ctx {
  env: Env;
  exec: ExecutionContext;
  limits: Limits;
  limiter: LimiterRpc;
}

export function makeCtx(env: Env, exec: ExecutionContext): Ctx {
  const id = env.CHAT_LIMITER.idFromName("global");
  return { env, exec, limits: parseLimits(env.LIMITS_JSON), limiter: env.CHAT_LIMITER.get(id) as unknown as LimiterRpc };
}

export interface Caller {
  principal: Principal;
  who: Who;
  pid: string;
  /** Tier as the API reports it (1.4 /me): free | owner | staff. */
  tier: "free" | "owner" | "staff";
  newAccount: boolean;
  rollout: boolean;
}

const DAY = 24 * 60 * 60_000;

export async function authenticate(ctx: Ctx, request: Request): Promise<Caller | { error: ErrorCode }> {
  const principal = await verifyIdToken(request.headers.get("authorization"), ctx.env);
  if (!principal) return { error: "auth" };
  if (await ctx.limiter.call("isTombstoned", principal.uid, principal.issuedAt)) return { error: "auth" };
  let account = await ctx.limiter.call("getAccount", principal.uid);
  if (!account) {
    const fresh = await fetchAccount(ctx.env, principal.uid);
    if (fresh) {
      await ctx.limiter.call("setAccount", principal.uid, fresh.tier, fresh.createdAt);
      account = { ...fresh, at: Date.now() };
    } else {
      // products-api unreachable: last known tier, else free (createdAt unknown → not counted as young)
      account = (await ctx.limiter.call("getStaleAccount", principal.uid)) ?? { tier: "free", createdAt: 0, at: 0 };
    }
  }
  const young = account.createdAt > 0 && Date.now() - account.createdAt < DAY;
  const newAccount = !principal.emailVerified || young;
  const tier: Caller["tier"] = principal.staff ? "staff" : account.tier;
  // Limits tier: staff > owner > new (unverified or under 24 h) > free
  const limitsTier: Tier = tier === "staff" ? "staff" : tier === "owner" ? "owner" : newAccount ? "new" : "free";
  const pid = await pidFor(principal.uid);
  return {
    principal,
    pid,
    tier,
    newAccount,
    rollout: inRollout(parseRollout(ctx.env.CHAT_ROLLOUT), limitsTier, pid),
    who: { uid: principal.uid, tier: limitsTier, staff: principal.staff, ip: clientIp(request), newAccount, issuedAt: principal.issuedAt },
  };
}

export const chatEnabled = (env: Env) => env.CHAT_ENABLED === "1";

export function reportTransition(ctx: Ctx, t: BudgetTransition | null | undefined) {
  if (!t) return;
  ctx.exec.waitUntil(Promise.all([
    opsNotify(ctx.env, `Support chat budget: ${t.state} (cause: ${t.cause})`),
    track(ctx.env, { name: "chat_budget", properties: { state: t.state, cause: t.cause, entry: "docs", surface: "web" } }),
  ]));
}
