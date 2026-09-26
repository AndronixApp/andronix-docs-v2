"use client";

import { OpenPanelComponent, useOpenPanel } from "@openpanel/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Docs analytics: our self-hosted OpenPanel (events.andronix.app), the same
// 'web' client as andronix.app. Cookie-less (the SDK sets no cookies), and
// skipped entirely when the build has no client id or the browser sends
// Do Not Track / Global Privacy Control. Custom events: docs_search and
// copy_code. Nothing typed into pages is sent except search queries.

type Nav = Navigator & { globalPrivacyControl?: boolean };

function optedOut() {
  const nav = navigator as Nav;
  return nav.doNotTrack === "1" || (window as Window & { doNotTrack?: string }).doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export function Analytics({ clientId }: { clientId?: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(Boolean(clientId) && !optedOut()), [clientId]);
  if (!enabled || !clientId) return null;
  return (
    <>
      <OpenPanelComponent
        apiUrl="https://events.andronix.app/api"
        scriptUrl="https://events.andronix.app/op1.js"
        clientId={clientId}
        trackScreenViews
        trackOutgoingLinks
      />
      <DocsEvents />
    </>
  );
}

function DocsEvents() {
  const op = useOpenPanel();
  const path = usePathname();

  useEffect(() => {
    // copy_code: which page, which code block on it, and its first line
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.("figure.shiki button");
      if (!button) return;
      const figure = button.closest("figure");
      const blocks = Array.from(document.querySelectorAll("article figure.shiki, main figure.shiki"));
      const firstLine = (figure?.querySelector("pre")?.textContent || "").split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) || "";
      op.track("copy_code", {
        path: location.pathname,
        block: blocks.indexOf(figure as Element) + 1,
        command: firstLine.slice(0, 120),
      });
    };

    // docs_search: the query once typing pauses, with how many results showed
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    const onInput = (e: Event) => {
      const input = e.target as HTMLInputElement | null;
      if (!input?.matches?.('input[aria-controls="fd-search-list"]')) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const query = input.value.trim().toLowerCase().slice(0, 80);
        if (query.length < 2 || query === last) return;
        last = query;
        const results = document.querySelectorAll("#fd-search-list [role='option']").length;
        op.track("docs_search", { query, results, path: location.pathname });
      }, 1200);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      clearTimeout(timer);
    };
  }, [op, path]);

  return null;
}
