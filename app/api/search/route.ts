import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { isUnlisted } from '@/lib/seo';

// Search covers the current docs (App 10) only. The App 8.x (Classic) copy under /v8
// stays reachable from the version menu, but isn't indexed so it never outranks the new pages.
const currentDocs: typeof source = {
  ...source,
  getPages: (...args: Parameters<typeof source.getPages>) => source.getPages(...args).filter((page) => page.slugs[0] !== 'v8' && !isUnlisted(page)),
};

// Built once into out/api/search as a static index; the browser searches it (no server).
export const revalidate = false;
export const { staticGET: GET } = createFromSource(currentDocs);
