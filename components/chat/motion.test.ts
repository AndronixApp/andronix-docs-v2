import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appearVariants, EXIT, SPRING } from "./motion-variants.ts";
import { currentLabel, formatElapsed, snippetOf, titlesById, traceSteps, traceSummary } from "./progress-logic.ts";
import { askHref } from "../selection-ask-href.ts";

test("motion: subtle, fast, no bounce; reduced motion moves nothing", () => {
  assert.equal((SPRING as { bounce: number }).bounce, 0);
  assert.ok((SPRING as { duration: number }).duration >= 0.15 && (SPRING as { duration: number }).duration <= 0.25);
  assert.ok((EXIT as { duration: number }).duration >= 0.15 && (EXIT as { duration: number }).duration <= 0.25);
  const up = appearVariants("up", false) as Record<string, Record<string, number>>;
  assert.equal(up.hidden.y, 6); assert.equal(up.hidden.opacity, 0);
  assert.equal((appearVariants("scale", false) as Record<string, Record<string, number>>).hidden.scale, 0.98);
  for (const k of ["up", "fade", "scale"] as const) {
    const r = appearVariants(k, true) as Record<string, Record<string, unknown>>;
    assert.deepEqual(r.hidden, r.shown, `${k}: reduced hidden = shown`);
    assert.ok(!("y" in r.hidden) && !("scale" in r.hidden));
  }
});

const tool = (name: string, state: string, input?: unknown, output?: unknown) => ({ type: "tool", name, state, input, output });

test("trace: only phases eve emitted; labels per tool; summary once the answer streams", () => {
  assert.equal(currentLabel(traceSteps([])), "Thinking…");
  const search = tool("kb_search", "running", { query: "vnc" });
  assert.equal(currentLabel(traceSteps([search])), "Searching the docs…");
  const searched = tool("kb_search", "completed", { query: "vnc" }, { results: [{ id: "vnc", title: "Set up VNC" }] });
  assert.equal(currentLabel(traceSteps([searched])), "Thinking…", "between tools: the base line");
  const reading = tool("kb_read", "running", { id: "vnc" });
  assert.equal(currentLabel(traceSteps([searched, reading])), "Reading Set up VNC…", "title from the search results");
  assert.equal(currentLabel(traceSteps([tool("get_report", "running", {})])), "Checking your report…");
  assert.equal(traceSteps([tool("offer_handoff", "completed"), tool("decline", "completed")]).length, 0, "no invented phases");
  const read = tool("kb_read", "completed", { id: "vnc" }, { url: "https://docs.andronix.app/use/vnc", title: "Set up VNC" });
  const read2 = tool("kb_read", "completed", { id: "d" }, { url: "https://docs.andronix.app/use/debian", title: "Install Debian" });
  assert.equal(traceSummary(traceSteps([searched, read, read2])), "Searched the docs, read 2 pages");
  assert.equal(traceSummary(traceSteps([tool("get_report", "completed")])), "Checked your report");
  assert.equal(traceSummary([]), null);
  assert.equal(formatElapsed(1234), "1.2s");
  assert.equal(titlesById([searched]).get("vnc"), "Set up VNC");
});

test("trace on a recorded fixture: 01 searches and reads pages", async () => {
  const { conversationOf } = await import("eve/client");
  const { createEventReader } = await import("../../node_modules/eve/dist/src/protocol/session-lines.js" as string);
  const tools = (name: string) => {
    const text = readFileSync(new URL(`../../lib/chat-contract/fixtures/streams/${name}.ndjson`, import.meta.url), "utf8");
    const r = createEventReader();
    const ev = text.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((l) => !("$eve" in l)).flatMap((l, i) => r.read(l, i));
    const c = conversationOf(ev) as { messages: { role: string; parts: { type: string }[] }[] };
    return c.messages.filter((m) => m.role === "assistant").flatMap((m) => m.parts).filter((p) => p.type === "tool") as never[];
  };
  const s1 = traceSummary(traceSteps(tools("01-answer-code-sources")));
  assert.match(s1 ?? "", /^Searched the docs, read \d+ pages?$/);
});

test("source card snippet: first prose line, markdown stripped, one line", () => {
  assert.equal(snippetOf("# Title\n\n```bash\nx\n```\nStart the [VNC server](/use/vnc) inside **Debian** first."), "Start the VNC server inside Debian first.");
  assert.ok(snippetOf("A".repeat(300)).length <= 120);
  assert.equal(snippetOf(undefined), "");
});

test("CSS: reduced motion turns off shimmer, caret, spinner and skeleton; no emojis in chat UI", () => {
  const css = readFileSync(new URL("../../app/(docs)/chat/chat.css", import.meta.url), "utf8");
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  for (const sel of [".chat-shimmer", ".chat-md-streaming > :last-child::after", ".chat-spinner", ".chat-skeleton-on::after"]) assert.ok(reduced.includes(sel), sel);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const f of ["chat-view.tsx", "progress.tsx", "cards.tsx", "message.tsx", "image-viewer.tsx", "motion.tsx"]) {
    assert.ok(!emoji.test(readFileSync(new URL(`./${f}`, import.meta.url), "utf8")), f);
  }
});

test("selection action: the passage becomes a prefilled question, never auto-sent", () => {
  const h = askHref("  Termux:X11 needs   Android 8  ");
  assert.equal(h, `/chat#q=${encodeURIComponent('About this part of the docs: "Termux:X11 needs Android 8"')}&src=docs`);
  assert.ok(decodeURIComponent(askHref("x".repeat(1000)).split("#q=")[1]).length < 460);
});

test("motion stays on /chat: only components/chat imports motion; features load lazily", async () => {
  const { execSync } = await import("node:child_process");
  const hits = execSync("grep -rl --include=*.ts --include=*.tsx \"from \\\"motion/react\\\"\" app components lib || true", { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert.ok(hits.length > 0);
  for (const h of hits) assert.match(h, /^components\/chat\//, h);
  const motion = readFileSync(new URL("./motion.tsx", import.meta.url), "utf8");
  assert.match(motion, /LazyMotion features=\{loadFeatures\} strict/);
  assert.match(motion, /import\("\.\/motion-features"\)/);
});
