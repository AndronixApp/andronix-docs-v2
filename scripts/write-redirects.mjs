// Writes public/_redirects from lib/redirects.mjs, so Cloudflare's static
// assets answer old URLs with a redirect without running a Worker. Run before
// `next build` (prebuild); the file is generated, not committed.
// Cloudflare matches _redirects paths exactly, so each old URL also gets its
// trailing-slash form (the old docs and many links used one), and every page's
// /page/ form gets a permanent 308 to /page (the asset server's own is a 307).
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { externalRedirects, legacyRedirects, v8Redirects } from '../lib/redirects.mjs';

const internal = [...v8Redirects, ...legacyRedirects];
const sources = new Set([...internal, ...externalRedirects].map(([from]) => from));
const slash = (rules, status) => rules
  .filter(([from]) => !from.includes('*') && !sources.has(from + '/'))
  .map(([from, to]) => `${from}/ ${to} ${status}`);

const root = 'content/docs';
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
});
const pages = walk(root).map((file) => {
  const parts = relative(root, file).replace(/\.mdx$/, '').split('/').filter((p) => !/^\(.+\)$/.test(p));
  if (parts.at(-1) === 'index') parts.pop();
  return '/' + parts.join('/');
}).filter((p) => p !== '/' && !sources.has(p + '/'));

const all = [
  ...internal.map(([from, to]) => `${from} ${to} 308`),
  ...externalRedirects.map(([from, to]) => `${from} ${to} 301`),
  ...slash(internal, 308),
  ...slash(externalRedirects, 301),
  ...pages.map((p) => `${p}/ ${p} 308`),
];
// Exact paths first, splats (/software/*, /blog/*) last, so a splat never shadows an exact rule.
const lines = [...all.filter((l) => !l.split(' ')[0].includes('*')), ...all.filter((l) => l.split(' ')[0].includes('*'))];
writeFileSync(new URL('../public/_redirects', import.meta.url), lines.join('\n') + '\n');
console.log(`write-redirects: ${lines.length} redirects`);
