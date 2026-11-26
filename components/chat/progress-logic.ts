// The thinking trace (owner 2026-11-26, after Beautiful UI's "Thinking / Steps"): steps come only
// from tool calls eve actually emitted in the turn. kb_search → "Searching the docs",
// kb_read → "Reading <page title>", get_report → "Checking your report". Anything else (the gate,
// model calls with no tool) is the base "Thinking…" line. No invented phases.

type ToolLike = { type: string; name?: string; state?: string; input?: unknown; output?: unknown };

export type Step = { kind: "search" | "read" | "report"; label: string; done: boolean; url?: string; title?: string };

const DONE = new Set(["completed", "failed", "rejected", "cancelled"]);

/** Page titles the session's kb_search results already named, by kb id (for "Reading <title>" before kb_read returns). */
export function titlesById(tools: readonly ToolLike[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tools) {
    if (t.name !== "kb_search" || !t.output || typeof t.output !== "object") continue;
    for (const r of (t.output as { results?: { id?: string; title?: string }[] }).results ?? []) if (r?.id && r.title) m.set(r.id, r.title);
  }
  return m;
}

export function traceSteps(tools: readonly ToolLike[], titles: Map<string, string> = titlesById(tools)): Step[] {
  const out: Step[] = [];
  for (const t of tools) {
    if (t.type !== "tool") continue;
    const done = DONE.has(t.state ?? "");
    if (t.name === "kb_search") out.push({ kind: "search", label: "Searching the docs", done });
    else if (t.name === "kb_read") {
      const o = (t.output ?? {}) as { title?: string; url?: string };
      const id = (t.input as { id?: string } | undefined)?.id;
      const title = o.title || (id ? titles.get(id) : undefined);
      out.push({ kind: "read", label: title ? `Reading ${title}` : "Reading a docs page", done, url: o.url, title });
    } else if (t.name === "get_report") out.push({ kind: "report", label: "Checking your report", done });
  }
  return out;
}

/** The live status line: the step in progress, else "Thinking". Always ends with an ellipsis. */
export function currentLabel(steps: readonly Step[]): string {
  const live = [...steps].reverse().find((s) => !s.done);
  return `${live ? live.label : "Thinking"}…`;
}

/** The collapsed one-line summary once the answer streams (the "tool chip"). */
export function traceSummary(steps: readonly Step[]): string | null {
  if (!steps.length) return null;
  const searched = steps.some((s) => s.kind === "search");
  const pages = new Set(steps.filter((s) => s.kind === "read").map((s) => s.url || s.label)).size;
  const report = steps.some((s) => s.kind === "report");
  const parts: string[] = [];
  if (searched) parts.push("Searched the docs");
  if (pages) parts.push(`read ${pages} ${pages === 1 ? "page" : "pages"}`);
  if (report) parts.push(parts.length ? "checked your report" : "Checked your report");
  if (!parts.length) return null;
  const s = parts.join(", ");
  return s[0].toUpperCase() + s.slice(1);
}

export const formatElapsed = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;

/** A one-line snippet for a source card: first prose line of the page text, markdown stripped. */
export function snippetOf(text: string | undefined, max = 120): string {
  if (!text) return "";
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l || l.startsWith("#") || l.startsWith("```") || l.startsWith("|") || /^[-*]\s*$/.test(l)) continue;
    const plain = l.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_>]/g, "").replace(/\s+/g, " ").trim();
    if (plain.length < 12) continue;
    return plain.length > max ? plain.slice(0, max - 1).trimEnd() + "…" : plain;
  }
  return "";
}
