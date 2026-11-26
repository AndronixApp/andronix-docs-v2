"use client";
// "Ask the assistant about this" on docs pages (owner 2026-11-26, after Beautiful UI's Selection
// Actions): select a passage in the article and a small button offers to open /chat with it
// pre-filled (#q=…, never auto-sent). Mounted only when NEXT_PUBLIC_CHAT_ENTRY=1 (hidden until
// rollout `all`), loaded as its own chunk. No motion library; one CSS fade.

import { useEffect, useState } from "react";
import { askHref, SELECTION_MIN as MIN } from "./selection-ask-href";


export default function SelectionAsk() {
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);
  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString() ?? "";
      if (!sel || sel.isCollapsed || text.trim().length < MIN) { setPos(null); return; }
      const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (!node?.closest("article, #nd-page")) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setPos({ x: Math.min(Math.max(r.left + r.width / 2, 110), window.innerWidth - 110), y: r.top + window.scrollY - 44, text });
    };
    const onDown = (e: MouseEvent) => { if (!(e.target as Element)?.closest?.(".selection-ask")) setPos(null); };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("mouseup", onUp); document.removeEventListener("keyup", onUp); document.removeEventListener("mousedown", onDown); };
  }, []);
  if (!pos) return null;
  return (
    <a className="selection-ask" href={askHref(pos.text)} style={{ left: pos.x, top: Math.max(pos.y, 8) }}>
      Ask the assistant about this
    </a>
  );
}
