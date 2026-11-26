/**
 * Reference implementation of plan 1.11 code verification (QA-1 S8: tightened).
 *
 * A code line is verified only when it equals, after whitespace collapse, a
 * **whole** line of the session's retrieved text, or the whole content of an
 * inline code span (`…`) in it. A substring of a longer line no longer counts
 * (`rm -rf /` inside `rm -rf /data/…/ubuntu-fs` is unverified).
 *
 * A block is verified when every non-empty, non-comment line is. Use
 * `verifyInline` for inline code in prose. The recorder uses this to compute
 * `.expected.json`; the page may vendor it.
 */
export function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip a leading shell prompt the docs or the model may add (`$ `, `# ` is a comment). */
function stripPrompt(line: string): string {
  return line.replace(/^\$\s+/, "");
}

/** Every whole line and every inline code span of the retrieved text, collapsed. */
export function verifiedSet(retrievedText: string): Set<string> {
  const set = new Set<string>();
  for (const raw of retrievedText.split("\n")) {
    const line = collapse(stripPrompt(raw));
    if (line) set.add(line);
    for (const m of raw.matchAll(/`([^`\n]+)`/g)) {
      const span = collapse(stripPrompt(m[1]!));
      if (span) set.add(span);
    }
  }
  return set;
}

export function verifyBlock(code: string, retrievedText: string | Set<string>): boolean {
  const set = typeof retrievedText === "string" ? verifiedSet(retrievedText) : retrievedText;
  return code
    .split("\n")
    .map((l) => collapse(stripPrompt(l)))
    .filter((line) => line !== "" && !line.startsWith("#"))
    .every((line) => set.has(line));
}

/** Inline code in prose (`…`): verified when it equals a whole line or span. */
export function verifyInline(code: string, retrievedText: string | Set<string>): boolean {
  const set = typeof retrievedText === "string" ? verifiedSet(retrievedText) : retrievedText;
  const c = collapse(stripPrompt(code));
  return c === "" || set.has(c);
}

/** Text a completed kb_search / kb_read call adds to the session's retrieved text. */
export function retrievedFromOutput(toolName: string, output: unknown): string {
  if (!output || typeof output !== "object") return "";
  if (toolName === "kb_search") {
    const results = (output as { results?: { text?: string }[] }).results ?? [];
    return results.map((r) => r.text ?? "").join("\n");
  }
  if (toolName === "kb_read") return String((output as { text?: string }).text ?? "");
  return "";
}
