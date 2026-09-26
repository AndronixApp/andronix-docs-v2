// Writes lib/app-shots.json: the app-10 screenshots that exist in public/images/app10.
// <AppShot> reads this list instead of the filesystem, because the page may be rendered
// where public/ isn't on disk (the Cloudflare Worker). Run by prebuild; the file is committed.
import { readdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const dir = 'public/images/app10';
const names = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort()
  : [];
const out = JSON.stringify(names, null, 2) + '\n';
const path = 'lib/app-shots.json';
const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (before !== out) writeFileSync(path, out);
console.log(`app-shots-manifest: ${names.length} screenshots${before !== out ? ' (updated lib/app-shots.json)' : ''}`);
