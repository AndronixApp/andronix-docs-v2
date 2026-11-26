// Copies stream A's contract parts into lib/chat-contract/ (build plan 1.0):
//   node scripts/vendor-chat-contract.mjs <agent-commit> [--check]
// from ~/andronix/andronix-support-agent (or $CHAT_AGENT_REPO) at that commit: contract/tools.ts,
// contract/chat-events.schema.json, contract/fixtures/streams/*, contract/fixtures/http/requests/*.
// Writes lib/chat-contract/VENDORED (the commit + each file's sha256). --check compares with the agent
// repo at that commit; --verify (CI, no access to the private repo) fails when a vendored file was
// edited here after vendoring.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
const [commit, flag] = process.argv.slice(2);
const sha = (s) => createHash('sha256').update(s).digest('hex');
if (commit === '--verify') {
  const out0 = new URL('../lib/chat-contract/', import.meta.url).pathname;
  const manifest = join(out0, 'VENDORED');
  if (!existsSync(manifest)) { console.log('vendor-chat-contract: nothing vendored yet (provisional fixtures)'); process.exit(0); }
  const [head, ...rows] = readFileSync(manifest, 'utf8').trim().split('\n');
  let bad = 0;
  for (const row of rows) { const [hash, file] = row.split('  '); const p = join(out0, file); if (!existsSync(p) || sha(readFileSync(p, 'utf8')) !== hash) { console.error(`drift: ${file}`); bad++; } }
  if (bad) process.exit(1);
  console.log(`vendor-chat-contract: ${rows.length} files match ${head}`);
  process.exit(0);
}
const repo = process.env.CHAT_AGENT_REPO ?? join(homedir(), 'andronix/andronix-support-agent');
const out = new URL('../lib/chat-contract/', import.meta.url).pathname;
if (!commit) { console.error('usage: vendor-chat-contract.mjs <agent-commit> [--check]'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
const list = (dir) => git('ls-tree', '--name-only', `${commit}:${dir}`).split('\n').filter(Boolean);
const vendoredHashes = [];
const files = [
  ['contract/tools.ts', 'tools.ts'],
  ['contract/chat-events.schema.json', 'chat-events.schema.json'],
  ['contract/internal.ts', 'internal.ts'],
  ['contract/erase.ts', 'erase.ts'],
  ['contract/verify.ts', 'verify.ts'],
  ['contract/images.ts', 'images.ts'],
  ...list('contract/fixtures/streams').map((f) => [`contract/fixtures/streams/${f}`, `fixtures/streams/${f}`]),
  ...list('contract/fixtures/http/requests').map((f) => [`contract/fixtures/http/requests/${f}`, `fixtures/http/requests/${f}`]),
];
let drift = 0;
if (flag !== '--check') {
  for (const d of ['fixtures/streams', 'fixtures/http/requests']) { rmSync(join(out, d), { recursive: true, force: true }); mkdirSync(join(out, d), { recursive: true }); }
}
for (const [src, dst] of files) {
  const body = git('show', `${commit}:${src}`);
  const path = join(out, dst);
  if (flag === '--check') { if (!existsSync(path) || readFileSync(path, 'utf8') !== body) { console.error(`drift: ${dst}`); drift++; } }
  else { writeFileSync(path, body); vendoredHashes.push(`${sha(body)}  ${dst}`); }
}
if (flag === '--check') {
  const vendored = existsSync(join(out, 'VENDORED')) ? readFileSync(join(out, 'VENDORED'), 'utf8').split('\n')[0].trim() : '';
  if (vendored !== commit) { console.error(`drift: VENDORED is ${vendored || 'missing'}, expected ${commit}`); drift++; }
  if (drift) process.exit(1);
  console.log(`vendor-chat-contract: in sync with ${commit}`);
} else {
  writeFileSync(join(out, 'VENDORED'), [commit, ...vendoredHashes].join('\n') + '\n');
  console.log(`vendor-chat-contract: ${files.length} files from ${commit}`);
}
