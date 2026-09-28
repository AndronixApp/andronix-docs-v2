// Writes public/_redirects from lib/redirects.mjs, so Cloudflare's static
// assets answer old URLs with a 308 without running a Worker. Run before
// `next build` (prebuild); the file is generated, not committed.
import { writeFileSync } from 'node:fs';
import { legacyRedirects, v8Redirects } from '../lib/redirects.mjs';

const lines = [...v8Redirects, ...legacyRedirects].map(([from, to]) => `${from} ${to} 308`);
writeFileSync(new URL('../public/_redirects', import.meta.url), lines.join('\n') + '\n');
console.log(`write-redirects: ${lines.length} redirects`);
