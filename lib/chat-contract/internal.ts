/**
 * Bodies eve sends to the Worker's internal API (plan 1.5). Owner: stream A.
 * The Worker validates them; see internal.md.
 */
import { z } from "zod";

/**
 * POST /chat-api/internal/usage, one per provider call (QA-1 S2).
 * - `costMicros` is the AI Gateway's own cost (`providerMetadata.gateway.cost`),
 *   or **null when unknown** (missing cost, an aborted or failed stream).
 *   Never 0 for unknown.
 * - `estimatedCostMicros` is eve's conservative ceiling for that call
 *   (tokens × list price, or a per-model worst case when tokens are unknown).
 *   The Worker counts `costMicros ?? estimatedCostMicros`.
 * - `outcome`: `finished` (normal end), `aborted` (cancelled/stopped mid-call),
 *   `error` (the provider call failed after it may have been billed).
 */
export const usageBody = z
  .object({
    generationId: z.string().min(1).max(200),
    uid: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    turnId: z.string().min(1).max(64),
    model: z.string().min(1).max(120),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cachedTokens: z.number().int().min(0),
    costMicros: z.number().int().min(0).nullable(),
    estimatedCostMicros: z.number().int().min(0),
    outcome: z.enum(["finished", "aborted", "error"]),
  })
  .strict();

export type UsageBody = z.infer<typeof usageBody>;

/**
 * POST /chat-api/internal/strike (guardrails §2). One per refused turn,
 * de-duplicated on (`sessionId`, `turnId`) by the Worker (turn ids restart at
 * `turn_0` in every session). Weights: offtopic 1, jailbreak 2,
 * harmful 2 (rolling 24 h; LIMITS_JSON.abuse). Never carries text.
 */
export const StrikeReason = z.enum(["offtopic", "jailbreak", "harmful"]);
export const STRIKE_WEIGHTS = { offtopic: 1, jailbreak: 2, harmful: 2 } as const;

export const strikeBody = z
  .object({
    uid: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    turnId: z.string().min(1).max(64),
    reason: StrikeReason,
  })
  .strict();

export type StrikeBody = z.infer<typeof strikeBody>;

/**
 * POST /chat-api/internal/gap (contract v4, knowledge gaps). Never carries the
 * user's message: `topic` and `summary` are the model's own words or the gate's
 * English search query, with emails, non-docs URLs, order ids, AX ids and long
 * digit runs stripped by eve (agent/lib/gap.ts). The Worker de-duplicates on
 * (sessionId, turnId, source), adds the entry and forwards to the desk action
 * `kb-gap`. Not counted against the user's limits. Answer 204.
 * - source `model`: the report_gap tool;
 * - `no_answer`: the no-answer fallback fired (auto, reason no_docs);
 * - `still_stuck`: the user tapped "Still stuck" (auto, reason partial; built
 *   by eve's `/eve/v1/andronix/gap-stuck` and sent by the Worker itself).
 */
export const GapSource = z.enum(["model", "no_answer", "still_stuck"]);
export const gapBody = z
  .object({
    uid: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    turnId: z.string().min(1).max(64),
    reason: z.enum(["no_docs", "partial", "outdated", "conflict", "unclear_question"]),
    topic: z.string().min(1).max(80),
    summary: z.string().min(1).max(300),
    pagesTried: z.array(z.string().min(1).max(200)).max(5),
    source: GapSource,
    auto: z.boolean(),
  })
  .strict();
export type GapBody = z.infer<typeof gapBody>;

/**
 * POST /eve/v1/andronix/gap-stuck (Worker → eve, edge + internal secret), sent
 * when the user taps "Still stuck" on a turn. eve answers 200
 * `{gap: GapBody | null}` (null: not the pid's session, no such turn, or nothing
 * to report); the Worker then handles the gap like POST /gap.
 */
export const gapStuckRequest = z
  .object({
    pid: z.string().regex(/^[0-9a-f]{32}$/),
    sessionId: z.string().min(1).max(128),
    turnId: z.string().min(1).max(64),
  })
  .strict();
export type GapStuckRequest = z.infer<typeof gapStuckRequest>;
