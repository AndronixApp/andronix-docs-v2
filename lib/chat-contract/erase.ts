/**
 * Erasure service path (Worker → eve). See erase.md. Owner: stream A.
 */
import { z } from "zod";

export const ERASE_PATH = "/eve/v1/andronix/erase" as const;
export const MAX_ERASE_SESSIONS = 200;

export const eraseRequest = z
  .object({
    pid: z.string().regex(/^[0-9a-f]{32}$/),
    sessionIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)).min(1).max(MAX_ERASE_SESSIONS),
  })
  .strict();

export const EraseOutcome = z.enum(["ended", "already_ended", "not_found", "not_owner", "failed"]);

export const eraseResult = z.object({ sessionId: z.string(), result: EraseOutcome });

export const eraseResponse = z.object({ ok: z.boolean(), results: z.array(eraseResult) });

export type EraseRequest = z.infer<typeof eraseRequest>;
export type EraseResult = z.infer<typeof eraseResult>;
export type EraseResponse = z.infer<typeof eraseResponse>;
