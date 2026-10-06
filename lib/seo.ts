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
  '/v8/android-12/andronix-on-android-12-and-beyond': '/troubleshooting/signal-9',
  '/v8/desktop-environments/desktop-environments': '/reference/desktops',
  '/v8/faq/faq': '/troubleshooting/faq',
  '/v8/get-started/how-does-andronix-work': '/start-here/what-is-andronix',
  '/v8/get-started/limitations': '/reference/limitations',
  '/v8/miscellaneous/open-source': '/miscellaneous/open-source',
  '/v8/modded-os/modded-os-installation': '/modded-os/modded-os-installation',
  '/v8/modded-os/modded-os': '/modded-os/modded-os',
  '/v8/security/termux': '/security/termux',
  '/v8/software/browsers': '/use/apps',
  '/v8/software/gimp': '/use/apps',
  '/v8/software/IDEs': '/use/apps',
  '/v8/software/libre-office': '/use/apps',
  '/v8/ssh/ssh-basics': '/use/ssh',
  '/v8/termux/cannot-link-executable': '/troubleshooting/termux',
  '/v8/termux/migrating-to-f-droid': '/start-here/install-termux',
  '/v8/troubleshoot/internal-storage': '/use/storage',
  '/v8/troubleshoot/sound': '/use/sound',
  '/v8/unmodded-distros/unmodded-os-installation': '/install/with-the-app',
  '/v8/unmodded-distros/unmodded-os-uninstallation': '/install/uninstall',
  '/v8/vnc/vnc-basics': '/reference/vnc',
  '/v8/window-managers/window-managers': '/pre-2.0/window-managers',
  '/v8/xsdl/xsdl-basics': '/pre-2.0/xsdl',
};

export const isV8 = (page: Page) => page.slugs[0] === 'v8';

// Sections that are online but not launched yet: left out of the sidebar (not in meta.json),
// the sitemap and search, and marked noindex. Remove a section from here when it launches.
const UNLISTED = new Set(['standalone']);
export const isUnlisted = (page: Page) => UNLISTED.has(page.slugs[0]);

/** The URL search engines should index for this page (a path, resolved against metadataBase). */
export function canonicalPath(page: Page): string {
  if (isV8(page)) return V8_CANONICAL[page.url] ?? '/v8';
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
