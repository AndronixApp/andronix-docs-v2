/**
 * Bodies eve sends to the Worker's internal API (plan 1.5). Owner: stream A.
 * The Worker validates them; see internal.md.
 */
import { z } from "zod";

/**
 * POST /chat-api/internal/usage, one per provider call (QA-1 S2).
 * - `costMicros` is OpenRouter's own cost, or **null when unknown** (missing
 *   `usage.cost`, an aborted or failed stream). Never 0 for unknown.
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
