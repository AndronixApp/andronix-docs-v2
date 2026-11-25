// Support chat Worker: bindings, vars and the limits config (build plan 1.3, 1.9).

export interface Env {
  ASSETS: Fetcher;
  CHAT_LIMITER: DurableObjectNamespace;

  FIREBASE_PROJECT_ID?: string;
  /** Project whose firebaseapp.com the /__/auth proxy targets (default FIREBASE_PROJECT_ID). */
  FIREBASE_AUTH_PROXY_PROJECT?: string;
  /** Dev only: the Auth emulator ("127.0.0.1:9099"). Never set on a deployed Worker. */
  FIREBASE_AUTH_EMULATOR_HOST?: string;

  EVE_ORIGIN?: string;
  EVE_EDGE_SECRET?: string;
  EVE_BYPASS_HEADER?: string;
  CHAT_INTERNAL_SECRET?: string;
  PRODUCTS_API_URL?: string;
  CHAT_SERVICE_SECRET?: string;
  DESK_API_URL?: string;
  DESK_API_KEY?: string;
  OPENPANEL_API_URL?: string;
  OPENPANEL_CLIENT_ID?: string;
  OPENPANEL_CLIENT_SECRET?: string;
  OPS_WEBHOOK_URL?: string;
  CHAT_ENABLED?: string;
  CHAT_ROLLOUT?: string;
  LIMITS_JSON?: string;
  /** Dev and tests only: a fixed "now" (ms) offset for alarm and expiry tests. */
  DEV_CLOCK?: string;
}

export type Tier = "free" | "owner" | "staff" | "new";
export type Budget = "normal" | "degrade" | "paused";

export interface TierLimits {
  minute: number;
  day: number;
  month: number;
  costDayMicros: number;
}

export interface Limits {
  tiers: Record<Tier, TierLimits>;
  turnsPerChat: number;
  maxChars: number;
  streamsConcurrent: number;
  streamOpensPerMinute: number;
  redeemPerIpPerMinute: number;
  newUidsPerIpPerDay: number;
  ticketsPerDay: number;
  monthStopMicros: number;
  degradeAt: number;
  freePauseAt: number;
  ownerPauseAt: number;
  watchdogMessages: number;
  watchdogWindowMs: number;
}

export const DEFAULT_LIMITS: Limits = {
  tiers: {
    free: { minute: 3, day: 10, month: 60, costDayMicros: 300_000 },
    owner: { minute: 3, day: 30, month: 300, costDayMicros: 1_000_000 },
    new: { minute: 3, day: 3, month: 30, costDayMicros: 100_000 },
    staff: { minute: 10, day: 200, month: 2000, costDayMicros: 3_000_000 },
  },
  turnsPerChat: 12,
  maxChars: 2000,
  streamsConcurrent: 3,
  streamOpensPerMinute: 30,
  redeemPerIpPerMinute: 10,
  newUidsPerIpPerDay: 30,
  ticketsPerDay: 3,
  monthStopMicros: 180_000_000,
  degradeAt: 0.4,
  freePauseAt: 0.85,
  ownerPauseAt: 1.0,
  watchdogMessages: 20,
  watchdogWindowMs: 15 * 60_000,
};

/** LIMITS_JSON overrides any subset of DEFAULT_LIMITS (tiers merge per tier). Bad JSON → defaults. */
export function parseLimits(json: string | undefined): Limits {
  if (!json) return DEFAULT_LIMITS;
  try {
    const o = JSON.parse(json) as Partial<Limits> & { tiers?: Partial<Record<Tier, Partial<TierLimits>>> };
    const tiers = { ...DEFAULT_LIMITS.tiers };
    for (const t of Object.keys(tiers) as Tier[]) tiers[t] = { ...tiers[t], ...(o.tiers?.[t] ?? {}) };
    return { ...DEFAULT_LIMITS, ...o, tiers };
  } catch {
    return DEFAULT_LIMITS;
  }
}

export type Rollout = { kind: "staff" } | { kind: "owners" } | { kind: "pct"; pct: number } | { kind: "all" };

export function parseRollout(v: string | undefined): Rollout {
  if (v === "all") return { kind: "all" };
  if (v === "owners") return { kind: "owners" };
  const m = /^pct:(\d{1,3})$/.exec(v ?? "");
  if (m) return { kind: "pct", pct: Math.min(100, Number(m[1])) };
  return { kind: "staff" };
}

/** Rollout gate. pct uses the first 8 hex chars of pid as a 0-99 bucket, so a user's bucket is stable. */
export function inRollout(r: Rollout, tier: Tier, pid: string): boolean {
  if (tier === "staff") return true;
  switch (r.kind) {
    case "all": return true;
    case "staff": return false;
    case "owners": return tier === "owner";
    case "pct": return tier === "owner" || parseInt(pid.slice(0, 8), 16) % 100 < r.pct;
  }
}
