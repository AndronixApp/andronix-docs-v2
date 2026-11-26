"use client";
// One assistant turn: markdown (no HTML, allowed links only), code blocks with session-wide
// verification, source chips, the known-issue chip, and the handoff form for offer_handoff.

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { parseBlocks, type Block, type Inline } from "./markdown";
import { isAllowedLink, shortPath } from "./links";
import { isVerified, UNVERIFIED_TEXT } from "./verify";
import { snippetOf } from "./progress-logic";
import { Appear, Presence } from "./motion";

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
            // docs links read as inline source chips (Beautiful UI "Streaming Text"); others stay links
            return <a key={i} href={x.href} className={external ? "chat-link" : "chat-inline-source"} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}><Inlines c={x.c} /></a>;
          }
        }
      })}
    </>
  );
}

/** Copy button with a check that draws in on success (reduced motion: the check just appears). */
export function CopyButton({ text, label = "Copy", className = "chat-code-copy" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className={`${className} ${copied ? "chat-copied" : ""}`} aria-live="polite" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
    }}>
      {copied && <svg className="chat-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

function CodeBlock({ block, settled, verified }: { block: Extract<Block, { t: "code" }>; settled: boolean; verified: boolean }) {
  if (settled && !verified) return <p className="chat-unverified">{UNVERIFIED_TEXT}</p>;
  const lines = block.text.split("\n");
  return (
    <div className={`chat-code ${settled ? "" : "chat-code-pending"}`}>
      <div className="chat-code-head">
        <span className="chat-code-lang">{block.lang || "shell"}</span>
        {settled && <CopyButton text={block.text} />}
      </div>
      <pre className={lines.length > 1 ? "chat-code-numbered" : ""}><code>{lines.map((line, i) => (
        <span key={i} className={line.trim().startsWith("#") ? "chat-code-comment" : "chat-code-line"}>{line}{"\n"}</span>
      ))}</code></pre>
    </div>
  );
}

export function Markdown({ text, settled, retrieved }: { text: string; settled: boolean; retrieved: Set<string> }) {
  const blocks = useMemo(() => parseBlocks(text, isAllowedLink), [text]);
  return (
    // a soft caret after the last block while the answer streams, removed on settle (CSS)
    <div className={`chat-md ${settled ? "" : "chat-md-streaming"}`}>
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
export function turnFacts(text: string, retrieved: Set<string>) {
  const blocks = parseBlocks(text, isAllowedLink);
  const code = blocks.filter((b): b is Extract<Block, { t: "code" }> => b.t === "code");
  const verifiedCode = code.filter((b) => isVerified(b.text, retrieved)).length;
  return { blocks: code.length, unverified: code.length - verifiedCode, verifiedCode, hasSteps: blocks.some((b) => b.t === "ol") };
}

/** Sources as context cards (title, path, one-line snippet), after Beautiful UI's "Context Cards". */
export function SourceChips({ tools }: { tools: ToolPart[] }) {
  const seen = new Set<string>();
  const cards: { url: string; title: string; snippet: string; known: boolean }[] = [];
  let knownIssue = false;
  for (const t of tools) {
    if (t.name !== "kb_read" || !t.output || typeof t.output !== "object") continue;
    const o = t.output as { url?: string; title?: string; kind?: string; status?: string; text?: string };
    if (o.kind === "known_issue" && (o.status === "investigating" || o.status === "fix_coming")) knownIssue = true;
    if (!o.url || !isAllowedLink(o.url) || seen.has(o.url)) continue;
    seen.add(o.url);
    cards.push({ url: o.url, title: o.title || shortPath(o.url), snippet: snippetOf(o.text), known: o.kind === "known_issue" });
  }
  if (!cards.length && !knownIssue) return null;
  return (
    <div className="flex flex-col gap-2">
      {knownIssue && <span className="chat-chip chat-chip-status self-start">Known issue · our team is on it</span>}
      {cards.length > 0 && (
        <div className="chat-sources">
          <Presence initial={false}>
            {cards.slice(0, 3).map((c) => (
              <Appear key={c.url} kind="up">
                <a href={c.url} className="chat-source-card">
                  <span className="chat-source-title">{c.title}</span>
                  <span className="chat-source-path">{shortPath(c.url)}</span>
                  {c.snippet && <span className="chat-source-snippet">{c.snippet}</span>}
                </a>
              </Appear>
            ))}
          </Presence>
        </div>
      )}
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
