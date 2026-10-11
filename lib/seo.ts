import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { InferPageType } from 'fumadocs-core/source';
import type { source } from '@/lib/source';

type Page = InferPageType<typeof source>;

export const SITE_URL = 'https://docs.andronix.app';
export const SITE_NAME = 'Andronix Docs';
export const OG_IMAGE = { url: '/og-image-1200x630.png', width: 1200, height: 630, alt: 'Andronix 2.0: Linux on Android' };

// The App 8.x (Classic) copy under /v8 stays online for app 8.x users, but each page points
// search engines at the current page on the same topic, so the old pages' links and rankings
// count for the new docs instead of competing with them.
const V8_CANONICAL: Record<string, string> = {
  '/v8': '/',
  '/v8/desktop-environments/desktop-environments': '/reference/desktops',
  '/v8/faq/faq': '/troubleshooting/faq',
  '/v8/get-started/limitations': '/reference/limitations',
  '/v8/modded-os/modded-os-installation': '/modded-os/modded-os-installation',
  '/v8/modded-os/modded-os': '/modded-os/modded-os',
  '/v8/termux/migrating-to-f-droid': '/termux/install-termux',
  '/v8/unmodded-distros/unmodded-os-installation': '/termux/with-the-app',
  '/v8/window-managers/window-managers': '/pre-2.0/older-installs',
};

// Termux-only pages that moved under /termux for 10.1 (lib/redirects.mjs termuxMoveRedirects)
const MOVED_TO_TERMUX: Record<string, string> = {
  '/start-here/install-termux': '/termux/install-termux',
  '/install/with-the-app': '/termux/with-the-app',
  '/install/without-the-app': '/termux/without-the-app',
  '/desktop/termux-x11': '/termux/termux-x11',
  '/reference/vnc': '/termux/vnc',
  '/use/storage': '/termux/storage',
  '/troubleshooting/termux': '/termux/errors',
  '/troubleshooting/desktop': '/termux/desktop-problems',
  '/use/ssh': '/termux/ssh',
  '/troubleshooting/install': '/termux/install-problems',
};

export const isV8 = (page: Page) => page.slugs[0] === 'v8';

// The App 10.0 copy under /v10 stays online while 10.1 rolls out in stages. 10.1's docs have
// every 10.0 page at the same path, so each /v10 page points search engines at that page.
export const isV10 = (page: Page) => page.slugs[0] === 'v10';
/** An older docs version (App 10.0, App 8.x): in the version menu, not in the sitemap or search. */
export const isArchive = (page: Page) => isV8(page) || isV10(page);

// Docs versions that are online but not public yet (like the 10.1 beta was): not the default
// version, left out of the sitemap and search, and marked noindex. Remove one from here when it launches.
const UNLISTED = new Set<string>([]);
export const isUnlisted = (page: Page) => UNLISTED.has(page.slugs[0]);

/** The URL search engines should index for this page (a path, resolved against metadataBase). */
export function canonicalPath(page: Page): string {
  if (isV8(page)) return V8_CANONICAL[page.url] ?? '/v8';
  if (isV10(page)) {
    const current = page.url.replace(/^\/v10(?=\/|$)/, '') || '/';
    return MOVED_TO_TERMUX[current] ?? current;
  }
  return page.url;
}

export const absoluteUrl = (p: string) => (p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p}`);

/** Extra frontmatter kept by the loose schema in source.config.ts. */
export function frontmatter(page: Page): { metaTitle?: string } {
  const data = page.data as Record<string, unknown>;
  return { metaTitle: typeof data.metaTitle === 'string' ? data.metaTitle : undefined };
}

const lastModCache = new Map<string, Date | undefined>();

/**
 * When the page's file last changed in git (its last real edit, not the build time).
 * Undefined when git or the history isn't available, e.g. a build from a tarball.
 */
export function lastModified(page: Page): Date | undefined {
  const file = path.join('content/docs', page.path);
  if (lastModCache.has(file)) return lastModCache.get(file);
  let date: Date | undefined;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) date = new Date(out);
  } catch {
    date = undefined;
  }
  lastModCache.set(file, date);
  return date;
}
