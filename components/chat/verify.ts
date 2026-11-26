// Session-wide code verification (build plan 1.11, review 2 F6). A code block in a settled turn
// is kept only when every non-empty, non-comment line, with whitespace collapsed, appears in
// the text the session retrieved so far (every kb_search and kb_read output). The retrieved
// text is derived from the session's own tool parts, so a resumed session rebuilds it.

import { retrievedFromOutput, verifiedSet, verifyBlock } from "../../lib/chat-contract/verify.ts";

export const UNVERIFIED_TEXT = "I can't confirm this command. See the linked docs page.";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

type ToolPartLike = { type: string; name?: string; output?: unknown; state?: string };
type MessageLike = { role: string; parts: readonly ToolPartLike[] };

/**
 * The units a command line can match (QA-1 S8), by the vendored contract rule
 * (lib/chat-contract/verify.ts, stream A): every whole line of the retrieved text and every
 * inline code span in it, whitespace collapsed, a leading "$ " dropped. No substring matches.
 */
export function retrievedUnits(messages: readonly MessageLike[]): Set<string> {
  return verifiedSet(retrievedChunks(messages).join("\n"));
}

function retrievedChunks(messages: readonly MessageLike[]): string[] {
  const chunks: string[] = [];
  for (const m of messages) for (const p of m.parts) if (p.type === "tool" && p.name) chunks.push(retrievedFromOutput(p.name, p.output));
  return chunks.filter(Boolean);
}

export function isVerified(code: string, units: Set<string>): boolean {
  return verifyBlock(code, units);
}
