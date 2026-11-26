// Support chat Worker: bindings, vars and the limits config (build plan 1.3, 1.9).

export interface Env {
  ASSETS: Fetcher;
  CHAT_LIMITER: DurableObjectNamespace;
  /** Re-encoded chat images, `<pid>/<imageId>.jpg`, ≤48 h (bucket lifecycle: 2 days). */
  CHAT_IMAGES?: R2Bucket;

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
  /** Image attachments: off | staff | owners | all (default off). One stage behind CHAT_ROLLOUT. */
  CHAT_IMAGES_ROLLOUT?: string;
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
  watchdogPauseMessages: number;
  watchdogPauseMs: number;
  /** Strikes and cooldowns (guardrails §2), per uid over a rolling window. */
  abuse: AbuseLimits;
  /** Image attachments (support-chat-images.md §1-2). */
  images: ImageLimits;
}

export interface ImageLimits {
  perMessage: number;
  perChat: number;
  /** Uploads per uid per UTC day, by limits tier (`new` = new or unverified: 0). */
  perDay: Record<Tier, number>;
  uploadsPerMinute: number;
  /** An upload never sent is deleted after this. */
  unsentMs: number;
  /** Every image is deleted after this, whatever happens. */
  maxAgeMs: number;
}

export type StrikeReason = "offtopic" | "jailbreak" | "harmful";
export interface AbuseLimits {
  windowMs: number;
  weights: Record<StrikeReason, number>;
  /** Ascending by points: reaching `points` within the window starts a cooldown of `ms`. */
  steps: { points: number; ms: number }[];
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
  watchdogPauseMessages: 60,
  watchdogPauseMs: 2 * 60 * 60_000,
  abuse: {
    windowMs: 24 * 60 * 60_000,
    weights: { offtopic: 1, jailbreak: 2, harmful: 2 },
    steps: [{ points: 3, ms: 10 * 60_000 }, { points: 6, ms: 60 * 60_000 }, { points: 10, ms: 24 * 60 * 60_000 }],
  },
  images: {
    perMessage: 2,
    perChat: 4,
    perDay: { free: 4, owner: 12, staff: 50, new: 0 },
    uploadsPerMinute: 6,
    unsentMs: 15 * 60_000,
    maxAgeMs: 48 * 60 * 60_000,
  },
};

/** LIMITS_JSON overrides any subset of DEFAULT_LIMITS (tiers merge per tier). Bad JSON → defaults. */
export function parseLimits(json: string | undefined): Limits {
  if (!json) return DEFAULT_LIMITS;
  try {
    const o = JSON.parse(json) as Partial<Limits> & { tiers?: Partial<Record<Tier, Partial<TierLimits>>> };
    const tiers = { ...DEFAULT_LIMITS.tiers };
    for (const t of Object.keys(tiers) as Tier[]) tiers[t] = { ...tiers[t], ...(o.tiers?.[t] ?? {}) };
    const abuse = { ...DEFAULT_LIMITS.abuse, ...(o.abuse ?? {}), weights: { ...DEFAULT_LIMITS.abuse.weights, ...(o.abuse?.weights ?? {}) } };
    abuse.steps = [...abuse.steps].sort((a, b) => a.points - b.points);
    const images = { ...DEFAULT_LIMITS.images, ...(o.images ?? {}), perDay: { ...DEFAULT_LIMITS.images.perDay, ...(o.images?.perDay ?? {}) } };
    return { ...DEFAULT_LIMITS, ...o, tiers, abuse, images };
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

export type ImagesRollout = "off" | "staff" | "owners" | "all";
export function parseImagesRollout(v: string | undefined): ImagesRollout {
  return v === "staff" || v === "owners" || v === "all" ? v : "off";
}

/**
 * Image attachments for this caller: only inside the chat rollout, then by CHAT_IMAGES_ROLLOUT
 * (lead decision 2026-11-26: images stay one stage behind the chat).
 */
export function inImagesRollout(v: string | undefined, chatRollout: boolean, tier: "free" | "owner" | "staff"): boolean {
  if (!chatRollout) return false;
  switch (parseImagesRollout(v)) {
    case "off": return false;
    case "staff": return tier === "staff";
    case "owners": return tier === "staff" || tier === "owner";
    case "all": return true;
  }
}
