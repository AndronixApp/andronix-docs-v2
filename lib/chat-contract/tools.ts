/**
 * Shared tool contract for the Andronix support chat (plan 1.11).
 *
 * Owner: stream A (andronix-support-agent). Vendored into the docs repo
 * (`lib/chat-contract/tools.ts`) by `scripts/vendor-chat-contract.mjs <commit>`.
 * Do not edit the vendored copy; change it here and re-vendor.
 *
 * Only depends on zod (v3.25+ or v4 `zod` import both work).
 */
import { z } from "zod";

export const CONTRACT_VERSION = 1 as const;

/** eve version the fixtures were recorded with. Both repos pin exactly this. */
export const EVE_VERSION = "1.5.0" as const;

/** Tool names the agent exposes. Nothing else may appear in `/eve/v1/info`. */
export const TOOL_NAMES = ["kb_search", "kb_read", "get_report", "offer_handoff"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const KbKind = z.enum(["doc", "known_issue"]);
export const KnownIssueStatus = z.enum(["investigating", "fix_coming", "fixed"]);

// ---------------------------------------------------------------- kb_search

export const kbSearchInput = z.object({
  query: z.string().min(1).max(200),
});

export const kbSearchResult = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  section: z.string(),
  kind: KbKind,
  status: KnownIssueStatus.optional(),
  text: z.string().max(1200),
});

export const kbSearchOutput = z.object({
  results: z.array(kbSearchResult).max(6),
});

// ---------------------------------------------------------------- kb_read

export const KB_READ_MAX_CHARS = 12_000;

export const kbReadInput = z.object({
  id: z.string().min(1).max(200),
});

export const kbReadOutput = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  kind: KbKind,
  status: KnownIssueStatus.optional(),
  text: z.string().max(KB_READ_MAX_CHARS),
  truncated: z.boolean(),
});

// ---------------------------------------------------------------- get_report

export const getReportInput = z.object({});

/**
 * The desk answers `null` for any field the report doesn't have (QA-1 S1):
 * a Help-tab report has no install fields, and `log` can be null. Every field
 * is nullable; the tool shows the model "unknown" for nulls.
 */
const reportField = z.string().nullable();
export const getReportOutput = z.union([
  z.object({ attached: z.literal(false) }),
  z.object({
    attached: z.literal(true),
    distro: reportField,
    de: reportField,
    step: reportField,
    outcome: reportField,
    phone: reportField,
    android: reportField,
    appVersion: reportField,
    log: z.string().max(6000).nullable(),
  }),
]);

// ---------------------------------------------------------------- offer_handoff

export const HandoffReason = z.enum(["money", "account", "stuck", "user_request"]);
export const HandoffTopic = z.enum([
  "purchase_locked",
  "refund",
  "billing_other",
  "account_access",
  "account_deletion",
  "legal",
  "install",
  "other",
]);

export const offerHandoffInput = z.object({
  reason: HandoffReason,
  topic: HandoffTopic,
});

export const offerHandoffOutput = z.object({ shown: z.literal(true) });

// ---------------------------------------------------------------- registry

export const toolSchemas = {
  kb_search: { input: kbSearchInput, output: kbSearchOutput },
  kb_read: { input: kbReadInput, output: kbReadOutput },
  get_report: { input: getReportInput, output: getReportOutput },
  offer_handoff: { input: offerHandoffInput, output: offerHandoffOutput },
} as const satisfies Record<ToolName, { input: z.ZodTypeAny; output: z.ZodTypeAny }>;

/**
 * UI rules per tool (plan 1.11), for the page:
 * - kb_search: not shown; output text feeds session-wide code verification.
 * - kb_read: one source chip per distinct url (max 3); known-issue chip when
 *   kind=known_issue and status is investigating or fix_coming. Output text
 *   feeds code verification.
 * - get_report: never rendered (streams, but the log is never displayed).
 * - offer_handoff: renders the "Send to support team" form card, prefilled
 *   from input.reason / input.topic.
 */
export const TOOL_UI = {
  kb_search: "verify-only",
  kb_read: "source-chip",
  get_report: "hidden",
  offer_handoff: "handoff-form",
} as const satisfies Record<ToolName, string>;

export const MAX_SOURCE_CHIPS = 3;

/**
 * Fixed reply text for gated turns (no answer-model call). Keys are gate
 * actions (agent/lib/gate.ts GATE_ACTIONS). Copy needs owner OK.
 */
export const GATE_REPLY = {
  money:
    "I can't help with payments, refunds or purchases here, but our support team can. Send them a message below and they'll reply by email.",
  account:
    "I can't help with account access or deletion here, but our support team can. Send them a message below and they'll reply by email.",
  injection: "I can only help with Andronix: installing and using Linux on Android, Termux and the app. What do you need help with?",
  off_topic: "I can only help with Andronix: installing and using Linux on Android, Termux and the app. What do you need help with?",
  unavailable:
    "I can't answer right now. Try again in a minute, or send your question to our support team below and they'll reply by email.",
} as const;

export type KbSearchInput = z.infer<typeof kbSearchInput>;
export type KbSearchOutput = z.infer<typeof kbSearchOutput>;
export type KbReadInput = z.infer<typeof kbReadInput>;
export type KbReadOutput = z.infer<typeof kbReadOutput>;
export type GetReportOutput = z.infer<typeof getReportOutput>;
export type OfferHandoffInput = z.infer<typeof offerHandoffInput>;
