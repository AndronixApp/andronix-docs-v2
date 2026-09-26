import type { CSSProperties } from "react";

// Andronix 2.0 marks (icon-2.0/final/marks). Glyphs use currentColor; the
// block marks are the colour versions, each drawn for its own tile colour
// (Modded on olive, Premium on deep orange), so they sit on that tile here.

export function ModdedGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: '<path fill="currentColor" fill-rule="evenodd" d="M19.41 9.8A9 9 0 1 1 14.2 4.59A5.4 5.4 0 0 0 19.41 9.8ZM3.4 15A3.8 3.8 0 0 1 11 15A3.8 3.8 0 0 1 18.6 15V16C18.6 19.6 15.4 20.6 11 20.6C6.6 20.6 3.4 19.6 3.4 16Z"/><path fill="currentColor" d="M5.6 15.5A1.6 1.6 0 1 0 8.8 15.5A1.6 1.6 0 1 0 5.6 15.5ZM13.2 15.5A1.6 1.6 0 1 0 16.4 15.5A1.6 1.6 0 1 0 13.2 15.5ZM9.6 17.6h2.8l-1.4 1.8ZM19.6 0.5Q19.6 4.4 23.5 4.4Q19.6 4.4 19.6 8.3Q19.6 4.4 15.7 4.4Q19.6 4.4 19.6 0.5Z"/>' }} />
  );
}

export function PremiumGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: '<path fill="currentColor" fill-rule="evenodd" d="M19.41 9.8A9 9 0 1 1 14.2 4.59A5.4 5.4 0 0 0 19.41 9.8ZM3.4 15A3.8 3.8 0 0 1 11 15A3.8 3.8 0 0 1 18.6 15V16C18.6 19.6 15.4 20.6 11 20.6C6.6 20.6 3.4 19.6 3.4 16Z"/><path fill="currentColor" d="M5.6 15.5A1.6 1.6 0 1 0 8.8 15.5A1.6 1.6 0 1 0 5.6 15.5ZM13.2 15.5A1.6 1.6 0 1 0 16.4 15.5A1.6 1.6 0 1 0 13.2 15.5ZM9.6 17.6h2.8l-1.4 1.8ZM16.62 6.6L16.2 2.11L18.23 3.64L19.7 1.5L21.17 3.64L23.2 2.11L22.78 6.6Z"/>' }} />
  );
}

const tile: Record<"modded" | "premium", { bg: string; src: string; label: string }> = {
  modded: { bg: "var(--andronix-tertiary-container)", src: "/images/marks/modded-on-olive.svg", label: "Modded OS" },
  premium: { bg: "var(--andronix-primary-container)", src: "/images/marks/premium-on-deep-orange.svg", label: "Premium" },
};

// The colour mark on its tile, e.g. at the top of the Modded OS page.
export function MarkTile({ kind, size = 56, style }: { kind: "modded" | "premium"; size?: number; style?: CSSProperties }) {
  const t = tile[kind];
  return (
    <span
      className="mark-tile not-prose inline-grid place-items-center"
      style={{ background: t.bg, width: size, height: size, borderRadius: "var(--andronix-radius-tile)", ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.src} alt={t.label} width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} />
    </span>
  );
}
