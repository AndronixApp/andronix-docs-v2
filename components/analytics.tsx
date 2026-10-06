"use client";

import { useOpenPanel } from "@openpanel/nextjs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The docs' own events, sent through the OpenPanel component in app/layout.tsx: docs_search,
// copy_code and play_store_click (page views and link_out come from the component itself).
// Nothing typed into pages is sent except search queries.

export function DocsEvents() {
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

    // play_store_click: a link to the Andronix app on Google Play (play.andronix.app, the store
    // page or the beta opt-in), with the page and the link text, like the website's event
    const onPlayClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const href = a?.getAttribute("href") || "";
      const play =
        href.startsWith("https://play.andronix.app") ||
        href.includes("play.google.com/store/apps/details?id=studio.com.techriz.andronix") ||
        href.startsWith("https://play.google.com/apps/testing/studio.com.techriz.andronix");
      if (!play) return;
      op.track("play_store_click", { path: location.pathname, label: (a?.textContent || "").trim().slice(0, 60) });
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
    document.addEventListener("click", onPlayClick, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("click", onPlayClick, true);
      document.removeEventListener("input", onInput, true);
      clearTimeout(timer);
    };
  }, [op, path]);

  return null;
}
