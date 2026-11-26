// Knowledge gaps (contract v4, A's contract/internal.ts gapBody): questions the assistant couldn't answer well.
// - eve → POST /chat-api/internal/gap (x-chat-internal): the report_gap tool and the no-answer auto-report;
// - "Still stuck" (first tap per turn, chat.ts feedback) → eve POST /eve/v1/andronix/gap-stuck → the same path.
// The Worker de-duplicates on (sessionId, turnId, source) in the session record, adds the entry and the session/turn
// ids, forwards to the desk's chat-scoped `kb-gap` action and sends chat_gap_reported {reason, auto}. Gaps never touch
// the user's limits or budget. eve already stripped personal data; the Worker never adds the uid, pid or email.

import type { Ctx } from "./context.ts";
import { pidFor } from "./crypto.ts";
import { fail, noContent, readJson } from "./http.ts";
import { track } from "./clients.ts";
import type { Entry } from "./body.ts";

export const GAP_REASONS = ["no_docs", "partial", "outdated", "conflict", "unclear_question"] as const;
export const GAP_SOURCES = ["model", "no_answer", "still_stuck"] as const;
const GAP_KEYS = ["uid", "sessionId", "turnId", "reason", "topic", "summary", "pagesTried", "source", "auto"];

export interface Gap {
  uid: string; sessionId: string; turnId: string;
  reason: (typeof GAP_REASONS)[number]; topic: string; summary: string; pagesTried: string[];
  source: (typeof GAP_SOURCES)[number]; auto: boolean;
}

const str = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** The exact contract shape (strict keys, enums, lengths), or null. */
export function parseGap(b: unknown): Gap | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (Object.keys(o).some((k) => !GAP_KEYS.includes(k)) || GAP_KEYS.some((k) => !(k in o))) return null;
  if (!str(o.uid, 128) || !str(o.sessionId, 128) || !str(o.turnId, 64) || !str(o.topic, 80) || !str(o.summary, 300)) return null;
  if (!(GAP_REASONS as readonly unknown[]).includes(o.reason) || !(GAP_SOURCES as readonly unknown[]).includes(o.source)) return null;
  if (typeof o.auto !== "boolean" || !Array.isArray(o.pagesTried) || o.pagesTried.length > 5 || !o.pagesTried.every((p) => str(p, 200))) return null;
  return o as unknown as Gap;
}

/** The desk's kb-gap body: no uid, pid or email; the session and turn ids and the entry added here. */
export function deskGapBody(g: Gap, entry: Entry) {
  return {
    idempotencyKey: `${g.sessionId}:${g.turnId}:${g.source}`,
    reason: g.reason, topic: g.topic.trim(), summary: g.summary.trim(), pagesTried: g.pagesTried,
    source: g.source, auto: g.auto, entry, sessionId: g.sessionId, turnId: g.turnId,
  };
}

const base = (u: string) => u.replace(/\/$/, "");

/** With DESK_API_URL unset (preview, dev) nothing is sent; true = the desk took it. */
export async function deskGap(ctx: Ctx, body: ReturnType<typeof deskGapBody>): Promise<boolean> {
  if (!ctx.env.DESK_API_URL) return true;
  try {
    const res = await fetch(`${base(ctx.env.DESK_API_URL)}/api/agent/kb-gap`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ctx.env.DESK_API_KEY ?? ""}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * De-duplicates, then (in the background) forwards to the desk and tracks the event.
 * "dup" = already seen for this (session, turn, source); "not_owner" = no such session for that uid.
 */
export async function acceptGap(ctx: Ctx, g: Gap): Promise<"ok" | "dup" | "not_owner"> {
  const r = await ctx.limiter.call("gap", g.uid, g.sessionId, g.turnId, g.source);
  if (!r.ok) return "not_owner";
  if (!r.first) return "dup";
  const pid = await pidFor(g.uid);
  const surface = r.entry === "app_help" || r.entry === "app_install_failed" ? "app_webview" : "web";
  ctx.exec.waitUntil(
    (async () => {
      const ok = await deskGap(ctx, deskGapBody(g, r.entry));
      if (!ok) console.error(JSON.stringify({ evt: "chat.gap_desk_failed", source: g.source }));
      await track(ctx.env, { name: "chat_gap_reported", profileId: pid, properties: { reason: g.reason, auto: g.auto, entry: r.entry, surface } });
    })(),
  );
  return "ok";
}

/** POST /chat-api/internal/gap: 204 for new and repeated gaps alike; 400 on a bad body; 403 not_owner. */
export async function internalGap(ctx: Ctx, request: Request): Promise<Response> {
  const g = parseGap(await readJson(request));
  if (!g) return fail("bad_body");
  const r = await acceptGap(ctx, g);
  if (r === "not_owner") return fail("not_owner");
  return noContent();
}

/**
 * "Still stuck" on a turn: ask eve for that turn's gap (topic from the turn's search, pages it read; eve checks the
 * pid owns the session), then accept it like POST /gap. Never throws; runs in waitUntil.
 */
export async function stuckGap(ctx: Ctx, uid: string, sessionId: string, turnId: string): Promise<"ok" | "dup" | "none" | "not_owner" | "upstream"> {
  if (!ctx.env.EVE_ORIGIN) return "none";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-eve-edge": ctx.env.EVE_EDGE_SECRET ?? "",
    "x-chat-internal": ctx.env.CHAT_INTERNAL_SECRET ?? "",
  };
  if (ctx.env.EVE_BYPASS_HEADER) headers["x-vercel-protection-bypass"] = ctx.env.EVE_BYPASS_HEADER;
  try {
    const res = await fetch(`${base(ctx.env.EVE_ORIGIN)}/eve/v1/andronix/gap-stuck`, {
      method: "POST", headers, body: JSON.stringify({ pid: await pidFor(uid), sessionId, turnId }), signal: AbortSignal.timeout(10_000), redirect: "manual",
    });
    if (res.status !== 200) return "upstream";
    const body = (await res.json().catch(() => null)) as { gap?: unknown } | null;
    if (!body?.gap) return "none";
    const g = parseGap(body.gap);
    // eve answers for the pid's own session only; the ids must match what was asked
    if (!g || g.uid !== uid || g.sessionId !== sessionId || g.turnId !== turnId || g.source !== "still_stuck") return "none";
    return acceptGap(ctx, g);
  } catch {
    return "upstream";
  }
}
