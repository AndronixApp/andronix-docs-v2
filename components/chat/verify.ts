// Session-wide code verification (build plan 1.11, review 2 F6). A code block in a settled turn
// is kept only when every non-empty, non-comment line, with whitespace collapsed, appears in
// the text the session retrieved so far (every kb_search and kb_read output). The retrieved
// text is derived from the session's own tool parts, so a resumed session rebuilds it.

export const UNVERIFIED_TEXT = "I can't confirm this command. See the linked docs page.";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

type ToolPartLike = { type: string; name?: string; output?: unknown; state?: string };
type MessageLike = { role: string; parts: readonly ToolPartLike[] };

/**
 * The units a command line can match (QA-1 S8): every whole line of the retrieved text and every
 * inline code span in it, whitespace collapsed, with a leading "$ " prompt dropped. A line of a
 * reply's code block verifies only when it equals one of them, so a cut-down command
 * (`rm -rf /` from `rm -rf /data/…/ubuntu-fs`) doesn't.
 */
export function retrievedUnits(messages: readonly MessageLike[]): Set<string> {
  const units = new Set<string>();
  const add = (s: string) => { const c = collapse(s).replace(/^\$\s+/, ""); if (c) units.add(c); };
  for (const text of retrievedChunks(messages)) {
    for (const line of text.split("\n")) add(line);
    for (const m of text.matchAll(/`([^`\n]+)`/g)) add(m[1]);
  }
  return units;
}

function retrievedChunks(messages: readonly MessageLike[]): string[] {
  const chunks: string[] = [];
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type !== "tool" || !p.output || typeof p.output !== "object") continue;
      const o = p.output as { text?: unknown; results?: { text?: unknown }[] };
      if (p.name === "kb_read" && typeof o.text === "string") chunks.push(o.text);
      if (p.name === "kb_search" && Array.isArray(o.results)) for (const r of o.results) if (typeof r?.text === "string") chunks.push(r.text);
    }
  }
  return chunks;
}

/** The lines a block must match: non-empty, not a comment, whitespace collapsed, "$ " dropped. */
export function checkedLines(code: string): string[] {
  return code.split("\n").map((l) => collapse(l).replace(/^\$\s+/, "")).filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
}

export function isVerified(code: string, units: Set<string>): boolean {
  const lines = checkedLines(code);
  if (lines.length === 0) return true; // comments only: nothing to run
  return lines.every((l) => units.has(l));
}
