import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { absoluteUrl, isArchive, isUnlisted, lastModified } from '@/lib/seo';

// Written once at build time into out/sitemap.xml. Search engines and the support desk's nightly
// docs index (it reads https://docs.andronix.app/sitemap.xml and skips /v8) both use it.
export const dynamic = 'force-static';

// Current docs only: the /v10 and /v8 pages point their canonical at the current pages (lib/seo.ts).
// lastmod is the page's last git commit, so it only moves when the page really changes.
export default function sitemap(): MetadataRoute.Sitemap {
  return source
    .getPages()
    .filter((page) => !isArchive(page) && !isUnlisted(page))
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((page) => {
      const modified = lastModified(page);
      return { url: absoluteUrl(page.url), ...(modified && { lastModified: modified }) };
    });
}
