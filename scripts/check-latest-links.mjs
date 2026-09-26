// Build check: App 10 pages (content/docs/(latest), including the blog) must not link to a URL that
// only exists in the App 8.x (Classic) copy under /v8, or to an old URL that redirects there.
// Deliberate links to /v8 itself (the "Using app 8.x?" notes) are fine. Run by `pnpm build` (prebuild).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { v8Redirects } from '../lib/redirects.mjs';

const root = 'content/docs';
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
});
// URL of a page: path segments without folder groups like (latest), without a trailing /index
const urlOf = (file) => {
  const parts = relative(root, file).replace(/\.mdx$/, '').split('/').filter((p) => !/^\(.+\)$/.test(p));
  if (parts.at(-1) === 'index') parts.pop();
  return '/' + parts.join('/');
};

const latestFiles = walk(join(root, '(latest)'));
const latestUrls = new Set(latestFiles.map(urlOf));
const v8Urls = new Set(walk(join(root, 'v8')).map(urlOf));
const redirectedToV8 = new Map(v8Redirects);

const link = /(?:\]\(|href=\{?["'])((?:https:\/\/docs\.andronix\.app)?\/[A-Za-z0-9_\-/.%]*)(#[^)"'\s]*)?/g;
const problems = [];
for (const file of latestFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(link)) {
    const path = (match[1].replace('https://docs.andronix.app', '').replace(/\/$/, '') || '/');
    if (path.startsWith('/images/') || path === '/v8' || path.startsWith('/v8/')) continue;
    if (latestUrls.has(path)) continue;
    if (redirectedToV8.has(path) || v8Urls.has('/v8' + path)) {
      problems.push(`${file}: ${match[0].replace(/^\]\(|^href=\{?["']/, '')} only exists in the App 8.x docs (/v8${path}); link the App 10 page instead`);
    }
  }
}

if (problems.length) {
  console.error(`check-latest-links: ${problems.length} App 10 link(s) point at App 8.x pages:\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`check-latest-links: ${latestFiles.length} App 10 pages, no links into the App 8.x docs`);
