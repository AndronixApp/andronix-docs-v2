'use client';

// Halloween look (card #189, look A by images: halftone harvest moon and bats, brand brown, pumpkin orange).
// Everything is hidden unless public/season.js sets html[data-season] (see lib/season.mjs).
import Link from 'next/link';
import { X } from 'lucide-react';
import { SALE } from '@/lib/season.mjs';

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
        <span className="season-eyebrow sale-off">Halloween</span>
        <span className="sale-off">
          <strong>Happy Halloween from Andronix.</strong>
          <span className="season-more"> A full Linux desktop on your phone, no tricks.</span>
        </span>
        <a className="sale-off" href="https://andronix.app/products/modded-os">See Modded OS →</a>
        {SALE.active && <span className="season-eyebrow sale-on">Halloween sale · until {SALE.until}</span>}
        {SALE.active && <span className="sale-on"><strong>Modded Pass and Andronix Complete, {SALE.percent} off.</strong></span>}
        {SALE.active && <a className="sale-on" href="/modded-os/modded-os#prices">See the prices →</a>}
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
        <span className="font-bold sale-off">Happy Halloween</span>
        <span className="text-xs opacity-85 sale-off">Five ready-made Modded OS desktops →</span>
        {SALE.active && <span className="font-bold sale-on">Halloween sale: {SALE.percent} off</span>}
        {SALE.active && <span className="text-xs opacity-85 sale-on">Modded Pass and Andronix Complete, until {SALE.until} →</span>}
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
        <b className="sale-off">Happy Halloween from Andronix</b>
        <span className="sale-off">A full Linux desktop on your phone, no tricks.</span>
        {SALE.active && <b className="sale-on">Halloween sale: {SALE.percent} off until {SALE.until}</b>}
        {SALE.active && <a className="sale-on" href="/modded-os/modded-os#prices">Modded Pass and Andronix Complete. See the prices →</a>}
      </div>
    </aside>
  );
}
