// Fails the build when a page uses a screenshot that doesn't exist, so nothing ever renders as a blank
// slot. <AppShot name> needs public/images/app10/<name>.png; <Shot name> needs public/images/<name>.jpg.
// PENDING lists shots that are on their way, each with a deadline: before it the build only warns, after
// it the build fails until the shot lands or the page drops the image (lead, #155).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PENDING = {
};

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
});
const now = Date.now();
const problems = [];
const waiting = [];
for (const file of walk('content/docs')) {
  const text = readFileSync(file, 'utf8');
  for (const [, kind, name] of text.matchAll(/<(AppShot|Shot)\s+name=["']([^"']+)["']/g)) {
    const path = kind === 'AppShot' ? `public/images/app10/${name}.png` : `public/images/${name}.jpg`;
    if (existsSync(path)) continue;
    const due = PENDING[name];
    if (due && now < Date.parse(due)) waiting.push(`${name} (${file}, due ${due})`);
    else problems.push(`${file}: <${kind} name="${name}"> but ${path} doesn't exist${due ? ` (deadline ${due} passed: add the shot or remove the image)` : ''}`);
  }
}
for (const w of waiting) console.warn(`check-shots: waiting for ${w}`);
if (problems.length) {
  console.error(`check-shots: ${problems.length} missing screenshot(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-shots: every screenshot on the pages exists${waiting.length ? `, except ${waiting.length} still due` : ''}`);
