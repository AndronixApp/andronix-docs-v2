'use client';

// Halloween look (card #189, look A by images: halftone harvest moon and bats, brand brown, pumpkin orange).
// Everything is hidden unless public/season.js sets html[data-season] (see lib/season.mjs).
import Link from 'next/link';
import { X } from 'lucide-react';

export function SeasonBar({ id }: { id: string }) {
  function dismiss() {
    document.documentElement.setAttribute('data-season-bar-dismissed', '');
    try {
      localStorage.setItem(`andronix-banner-${id}`, 'dismissed');
    } catch {}
  }
  return (
    <div className="season-bar" role="region" aria-label="Halloween">
      <img className="season-tile" src="/images/halloween/pumpkin-tile.webp" width={96} height={96} alt="" />
      <p>
        <span className="season-eyebrow">Halloween</span>
        <span>
          <strong>Happy Halloween from Andronix.</strong>
          <span className="season-more"> A full Linux desktop on your phone, no tricks.</span>
        </span>
        <a href="https://andronix.app/products/modded-os">See Modded OS →</a>
      </p>
      <button type="button" className="season-x" aria-label="Dismiss" onClick={dismiss}>
        <X className="size-4" />
      </button>
    </div>
  );
}

export function SeasonSidebarCard() {
  return (
    <Link href="/modded-os/modded-os" className="season-side">
      <span className="flex flex-col gap-0.5">
        <span className="season-eyebrow">Halloween</span>
        <span className="font-bold">Happy Halloween</span>
        <span className="text-xs opacity-85">Five ready-made Modded OS desktops →</span>
      </span>
    </Link>
  );
}

export function SeasonHomeArt() {
  return (
    <aside className="season-home" aria-label="Halloween">
      <img src="/images/halloween/pumpkin-tile.webp" width={96} height={96} alt="" />
      <div>
        <span className="season-eyebrow">Halloween</span>
        <b>Happy Halloween from Andronix</b>
        <span>A full Linux desktop on your phone, no tricks.</span>
      </div>
    </aside>
  );
}
