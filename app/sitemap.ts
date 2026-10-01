import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

// Built once into out/sitemap.xml (static export). Search engines and the support desk's
// nightly docs index (it reads https://docs.andronix.app/sitemap.xml) both use it.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({ url: new URL(page.url, 'https://docs.andronix.app').toString() }));
}
