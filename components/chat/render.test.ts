import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBlocks, inlineText } from "./markdown.ts";
import { isAllowedLink } from "./links.ts";
import { isVerified, retrievedUnits } from "./verify.ts";
const retrievedText = retrievedUnits;

test("links: exact hosts only", () => {
  for (const ok of [
    "https://docs.andronix.app/use/vnc", "https://andronix.app/pricing", "/use/vnc",
    "https://play.google.com/store/apps/details?id=studio.com.techriz.andronix",
    "https://github.com/termux/termux-x11/releases", "https://github.com/termux/termux-x11",
    "https://github.com/AndronixApp/andronix-distros/blob/master/README.md",
    "https://github.com/termux/termux-x11/releases/download/nightly/app-arm64-v8a-debug.apk",
    "https://dl.andronix.app/get.sh", "https://f-droid.org/packages/com.termux/", "https://f-droid.org/en/packages/com.termux/",
    "https://github.com/termux/termux-app/releases", "https://github.com/termux/termux-app/releases/tag/v0.118.3",
  ]) assert.equal(isAllowedLink(ok), true, ok);
  for (const bad of [
    "https://evil.example/login", "http://docs.andronix.app/x", "https://docs.andronix.app.evil.com/",
    "https://play.google.com/store/apps/details?id=com.other", "https://github.com/termux/termux-app",
    "https://github.com/termux/termux-x11/issues/1", "javascript:alert(1)", "//evil.example/x",
    "https://user@docs.andronix.app/", "data:text/html,hi",
    "https://f-droid.org/packages/com.evil/", "https://f-droid.org/packages/com.termux/?x=1", "https://github.com/termux/termux-app/issues",
    "https://github.com/termux/termux-app/blob/master/README.md", "https://dl.andronix.app.evil.com/get.sh",
  ]) assert.equal(isAllowedLink(bad), false, bad);
});

test("markdown: off-list link and image become text; raw HTML stays text", () => {
  const b = parseBlocks("See [docs](https://docs.andronix.app/use/vnc) and [phish](https://evil.example/x).\n\n![tracker](https://evil.example/p.png)\n\n<script>alert(1)</script>", isAllowedLink);
  assert.equal(b.length, 3);
  const p = b[0] as { t: "p"; c: { t: string }[] };
  assert.deepEqual(p.c.map((x) => x.t), ["text", "link", "text", "text", "text"]);
  assert.equal(inlineText((b[1] as { c: never[] }).c), "tracker");
  assert.equal(inlineText((b[2] as { c: never[] }).c), "<script>alert(1)</script>");
});

test("markdown: lists, code fences, inline code", () => {
  const b = parseBlocks("Steps:\n\n1. Start Arch.\n2. Run `pacman-key --init`.\n\n```bash\nvncserver :1\n```\nafter", isAllowedLink);
  assert.deepEqual(b.map((x) => x.t), ["p", "ol", "code", "p"]);
  assert.equal((b[1] as { items: unknown[] }).items.length, 2);
  assert.equal((b[2] as { text: string }).text, "vncserver :1");
  assert.equal((b[2] as { lang: string }).lang, "bash");
});

test("verification: lines must appear in retrieved text; comments ignored; whitespace collapsed", () => {
  const msgs = [{ role: "assistant", parts: [{ type: "tool", name: "kb_read", output: { text: "Run this:\n\n```bash\n$ pkg update -y && pkg install wget proot -y\nandronix install debian\n```\n\nThen run `pacman-key --init` once.\nrm -rf /data/data/com.termux/files/home/ubuntu-fs" } }] }];
  const r = retrievedUnits(msgs);
  assert.equal(isVerified("pkg update -y  &&  pkg install wget proot -y\n# a comment\nandronix install debian", r), true);
  assert.equal(isVerified("pacman-key --init", r), true, "an inline code span from the docs");
  assert.equal(isVerified("su -c 'setprop persist.sys.phantom_kill off'", r), false);
  assert.equal(isVerified("rm -rf /", r), false, "QA-1 S8: a cut-down command inside a longer docs line");
  assert.equal(isVerified("andronix install", r), false, "a prefix of a docs line");
});

/** Fixtures through eve's own projector, the way the page sees them. */
async function conversationFor(name: string) {
  const { conversationOf } = await import("eve/client");
  const text = readFileSync(new URL(`../../lib/chat-contract/fixtures/streams/${name}.ndjson`, import.meta.url), "utf8");
  const { createEventReader } = await import("eve/client").then(() => import("../../node_modules/eve/dist/src/protocol/session-lines.js" as string));
  const reader = createEventReader();
  const events = text.split("\n").filter(Boolean).flatMap((l, i) => reader.read(JSON.parse(l), i));
  return conversationOf(events) as { messages: { role: string; parts: { type: string; name?: string; output?: unknown; text?: string }[] }[] };
}

const codeBlocks = (messages: { role: string; parts: { type: string; text?: string }[] }[], idx = -1) => {
  const a = messages.filter((m) => m.role === "assistant").at(idx)!;
  const text = a.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
  return parseBlocks(text, isAllowedLink).filter((b): b is { t: "code"; lang: string; text: string; closed: boolean } => b.t === "code");
};

test("fixture 01: both code blocks verified", async () => {
  const c = await conversationFor("01-answer-code-sources");
  const r = retrievedText(c.messages);
  const blocks = codeBlocks(c.messages);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => isVerified(b.text, r)));
});

test("fixture 04: invented command → unverified", async () => {
  const c = await conversationFor("04-unverified-command");
  const blocks = codeBlocks(c.messages);
  assert.equal(blocks.length, 1);
  assert.equal(isVerified(blocks[0].text, retrievedText(c.messages)), false);
});

test("fixture 11: turn 2 repeats a turn-1 command with no tools → verified (session-wide)", async () => {
  const c = await conversationFor("11-followup-no-tools");
  const blocks = codeBlocks(c.messages);
  assert.ok(blocks.length >= 1);
  assert.ok(blocks.every((b) => isVerified(b.text, retrievedText(c.messages))));
});

test("guardrails: page refusal copy and buttons equal the vendored contract", async () => {
  const c = await import("../../lib/chat-contract/tools.ts");
  const p = await import("./refusals.ts");
  assert.deepEqual(p.REFUSAL_COPY, c.REFUSAL_COPY);
  assert.deepEqual(p.REFUSAL_BUTTONS, c.REFUSAL_BUTTONS);
  for (const reason of ["offtopic", "jailbreak", "harmful"]) assert.equal(p.refusalKey({ reason }), c.refusalKey(reason));
});

test("guardrails fixtures: 13 decline card only, 14 session ended by turn-outcome, 15 no-answer narration + stuck handoff", async () => {
  const c13 = await conversationFor("13-decline-offtopic");
  const a13 = c13.messages.filter((m) => m.role === "assistant").at(-1)!;
  const decline = a13.parts.find((x) => x.type === "tool" && x.name === "decline") as { input?: { reason?: string } } | undefined;
  assert.ok(decline, "decline tool part present");
  assert.equal((await import("./refusals.ts")).refusalKey(decline!.input), "offtopic");
  const text14 = readFileSync(new URL("../../lib/chat-contract/fixtures/streams/14-harmful-session-end.ndjson", import.meta.url), "utf8");
  assert.match(text14, /"cause":\{"hook":"turn-outcome"\}/);
  const c15 = await conversationFor("15-no-answer");
  const a15 = c15.messages.filter((m) => m.role === "assistant").at(-1)!;
  const t15 = a15.parts.filter((x) => x.type === "text").map((x) => x.text).join("");
  assert.equal(t15.trim(), (await import("./refusals.ts")).REFUSAL_COPY.no_answer);
  assert.ok(a15.parts.some((x) => x.type === "tool" && x.name === "offer_handoff"));
});

test("fixture 16 (gate unavailable, fail-closed): GATE_REPLY.unavailable as text + stuck handoff, no decline", async () => {
  const c = await conversationFor("16-gate-unavailable");
  const a = c.messages.filter((m) => m.role === "assistant").at(-1)!;
  const text = a.parts.filter((x) => x.type === "text").map((x) => x.text).join("").trim();
  const { GATE_REPLY } = await import("../../lib/chat-contract/tools.ts");
  assert.equal(text, (GATE_REPLY as Record<string, string>).unavailable);
  assert.ok(a.parts.some((x) => x.type === "tool" && x.name === "offer_handoff"));
  assert.ok(!a.parts.some((x) => x.type === "tool" && x.name === "decline"));
});
