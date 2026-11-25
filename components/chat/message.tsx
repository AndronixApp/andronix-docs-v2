"use client";
// One assistant turn: markdown (no HTML, allowed links only), code blocks with session-wide
// verification, source chips, the known-issue chip, and the handoff form for offer_handoff.

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { parseBlocks, type Block, type Inline } from "./markdown";
import { isAllowedLink, shortPath } from "./links";
import { isVerified, UNVERIFIED_TEXT } from "./verify";

export type ToolPart = { type: "tool"; name: string; callId: string; state: string; input?: unknown; output?: unknown };

function Inlines({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((x, i) => {
        switch (x.t) {
          case "text": return <Fragment key={i}>{x.v}</Fragment>;
          case "code": return <code key={i} className="chat-inline-code">{x.v}</code>;
          case "strong": return <strong key={i}><Inlines c={x.c} /></strong>;
          case "em": return <em key={i}><Inlines c={x.c} /></em>;
          case "link": {
            const external = !x.href.startsWith("/") && !x.href.startsWith("https://docs.andronix.app");
            return <a key={i} href={x.href} className="chat-link" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}><Inlines c={x.c} /></a>;
          }
        }
      })}
    </>
  );
}

function CodeBlock({ block, settled, verified }: { block: Extract<Block, { t: "code" }>; settled: boolean; verified: boolean }) {
  const [copied, setCopied] = useState(false);
  if (settled && !verified) return <p className="chat-unverified">{UNVERIFIED_TEXT}</p>;
  return (
    <div className={`chat-code ${settled ? "" : "chat-code-pending"}`}>
      <div className="chat-code-head">
        <span>{block.lang || "shell"}</span>
        {settled && (
          <button type="button" className="chat-code-copy" onClick={() => {
            navigator.clipboard?.writeText(block.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
          }}>{copied ? "Copied" : "Copy"}</button>
        )}
      </div>
      <pre><code>{block.text.split("\n").map((line, i) => (
        <span key={i} className={line.trim().startsWith("#") ? "chat-code-comment" : "chat-code-line"}>{line}{"\n"}</span>
      ))}</code></pre>
    </div>
  );
}

export function Markdown({ text, settled, retrieved }: { text: string; settled: boolean; retrieved: string }) {
  const blocks = useMemo(() => parseBlocks(text, isAllowedLink), [text]);
  return (
    <div className="chat-md">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p": return <p key={i}><Inlines c={b.c} /></p>;
          case "h": return <p key={i} className="font-semibold"><Inlines c={b.c} /></p>;
          case "ol": return <ol key={i} start={b.start}>{b.items.map((it, j) => <li key={j}><Inlines c={it} /></li>)}</ol>;
          case "ul": return <ul key={i}>{b.items.map((it, j) => <li key={j}><Inlines c={it} /></li>)}</ul>;
          case "code": return <CodeBlock key={i} block={b} settled={settled} verified={isVerified(b.text, retrieved)} />;
        }
      })}
    </div>
  );
}

/** What a settled turn shows besides its text (for Solved / Still stuck and chat_code_check). */
export function turnFacts(text: string, retrieved: string) {
  const blocks = parseBlocks(text, isAllowedLink);
  const code = blocks.filter((b): b is Extract<Block, { t: "code" }> => b.t === "code");
  const verifiedCode = code.filter((b) => isVerified(b.text, retrieved)).length;
  return { blocks: code.length, unverified: code.length - verifiedCode, verifiedCode, hasSteps: blocks.some((b) => b.t === "ol") };
}

export function SourceChips({ tools }: { tools: ToolPart[] }) {
  const seen = new Set<string>();
  const chips: { url: string; title: string; known: boolean }[] = [];
  let knownIssue = false;
  for (const t of tools) {
    if (t.name !== "kb_read" || !t.output || typeof t.output !== "object") continue;
    const o = t.output as { url?: string; title?: string; kind?: string; status?: string };
    if (o.kind === "known_issue" && (o.status === "investigating" || o.status === "fix_coming")) knownIssue = true;
    if (!o.url || !isAllowedLink(o.url) || seen.has(o.url)) continue;
    seen.add(o.url);
    chips.push({ url: o.url, title: o.title || shortPath(o.url), known: o.kind === "known_issue" });
  }
  if (!chips.length && !knownIssue) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {knownIssue && <span className="chat-chip chat-chip-status">Known issue · our team is on it</span>}
      {chips.slice(0, 3).map((c) => (
        <a key={c.url} href={c.url} className="chat-chip">
          <span className="chat-chip-title">{c.title}</span>
          <span className="chat-chip-path">{shortPath(c.url)}</span>
        </a>
      ))}
    </div>
  );
}

export function AssistantHeader() {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--andronix-on-surface-variant)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark.svg" alt="" width={18} height={18} className="rounded-[5px]" />
      <span>Andronix Assistant</span>
      <span className="chat-ai-badge">AI</span>
    </div>
  );
}

export function Bubble({ children }: { children: ReactNode }) {
  return <div className="chat-user-bubble">{children}</div>;
}
