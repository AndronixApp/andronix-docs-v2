import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { isArchive, isUnlisted } from '@/lib/seo';

// Search covers the current docs (App 10.1) only. The App 10.0 copy under /v10 and the App 8.x
// (Classic) copy under /v8 stay reachable from the version menu, but aren't indexed, so they never
// outrank the current pages.
const currentDocs: typeof source = {
  ...source,
  getPages: (...args: Parameters<typeof source.getPages>) => source.getPages(...args).filter((page) => !isArchive(page) && !isUnlisted(page)),
};

// Built once into out/api/search as a static index; the browser searches it (no server).
export const revalidate = false;
export const { staticGET: GET } = createFromSource(currentDocs);
