"use client";
// Thinking trace + loading line (after Beautiful UI's "Thinking (Steps)" and "Loading State",
// written for /chat, not copied). While the turn works and no text has arrived: a shimmering
// status line with an elapsed counter, and the steps eve emitted. Once the answer streams it
// collapses to a one-line summary chip that expands to the steps and the pages read.
// Reduced motion: static labels, no shimmer (CSS), no cross-fade (Appear).

import { useEffect, useRef, useState } from "react";
import { Appear, Presence } from "./motion";
import { currentLabel, formatElapsed, traceSteps, traceSummary, type Step } from "./progress-logic";
import { shortPath } from "./links";

type ToolLike = { type: string; name?: string; state?: string; input?: unknown; output?: unknown };

export function ThinkingTrace({ tools, working, hasText }: { tools: readonly ToolLike[]; working: boolean; hasText: boolean }) {
  const steps = traceSteps(tools);
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [frozen, setFrozen] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const live = working && !hasText;
  useEffect(() => {
    if (!live) { setFrozen((f) => f ?? Date.now() - started.current); return; }
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [live]);
  const elapsed = frozen ?? now - started.current;

  if (live) {
    const label = currentLabel(steps);
    return (
      <div className="chat-trace" aria-live="polite">
        <div className="chat-trace-line">
          {/* keyed: a new phase fades in over the old one (no exit wait, so it never sticks) */}
          <Appear key={label} kind="fade" as="span" className="chat-shimmer">{label}</Appear>
          <span className="chat-trace-elapsed">{formatElapsed(elapsed)}</span>
        </div>
        {steps.length > 0 && <StepList steps={steps} />}
      </div>
    );
  }
  const summary = traceSummary(steps);
  if (!summary) return null;
  return (
    <div className="chat-trace">
      <button type="button" className="chat-trace-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{summary}</span>
        <span className="chat-trace-elapsed">{formatElapsed(elapsed)}</span>
        <span className={`chat-trace-caret ${open ? "chat-trace-caret-open" : ""}`} aria-hidden="true" />
      </button>
      <Presence initial={false}>{open && <Appear key="steps" kind="up"><StepList steps={steps} /></Appear>}</Presence>
    </div>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="chat-steps">
      <Presence initial={false}>
        {steps.map((s, i) => (
          <Appear key={`${s.kind}-${i}`} kind="up" as="div" className={`chat-step ${s.done ? "chat-step-done" : "chat-step-live"}`}>
            <span className="chat-step-dot" aria-hidden="true" />
            <span className={s.done ? "" : "chat-shimmer"}>{s.label}</span>
            {s.done && s.url && <a className="chat-step-path" href={s.url}>{shortPath(s.url)}</a>}
          </Appear>
        ))}
      </Presence>
    </ol>
  );
}
