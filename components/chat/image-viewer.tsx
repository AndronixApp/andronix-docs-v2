"use client";
// Attached screenshots: a tile that shows the whole image (contain on a dark tile, not a crop of
// its top) and a viewer with the larger in-memory copy. Nothing is fetched: images are local only.

import { useEffect, useRef } from "react";

export function ImageTile({ src, label, onOpen }: { src: string; label: string; onOpen: () => void }) {
  return (
    <button type="button" className="chat-image-tile" onClick={onOpen} aria-label={`${label}: open full size`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="chat-image-thumb" src={src} alt={label} width={72} height={72} />
    </button>
  );
}

export function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="chat-viewer" role="dialog" aria-modal="true" aria-label="Screenshot" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="chat-viewer-img" src={src} alt="Attached screenshot, full size" onClick={(e) => e.stopPropagation()} />
      <button type="button" ref={closeRef} className="chat-btn chat-btn-secondary chat-viewer-close" onClick={onClose}>Close</button>
    </div>
  );
}
