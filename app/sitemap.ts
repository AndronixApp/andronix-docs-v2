import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { absoluteUrl, isV8, lastModified } from '@/lib/seo';

// Written once at build time into out/sitemap.xml.
export const dynamic = 'force-static';

// Current docs only: the /v8 pages point their canonical at the current pages (lib/seo.ts).
// lastmod is the page's last git commit, so it only moves when the page really changes.
export default function sitemap(): MetadataRoute.Sitemap {
  return source
    .getPages()
    .filter((page) => !isV8(page))
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((page) => {
      const modified = lastModified(page);
      return { url: absoluteUrl(page.url), ...(modified && { lastModified: modified }) };
    });
}
