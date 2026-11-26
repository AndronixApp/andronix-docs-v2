// Run by `pnpm run deploy`: the docs Worker (worker/index.ts) serves the Firebase sign-in proxy
// and the support chat API. Deploying a tree without it would take both down (ADR 0001).
import { existsSync, readFileSync } from 'node:fs';
const problems = [];
if (!existsSync(new URL('../worker/index.ts', import.meta.url))) problems.push('worker/index.ts is missing');
const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
if (!/^main\s*=\s*"worker\/index\.ts"/m.test(toml)) problems.push('wrangler.toml has no main = "worker/index.ts"');
if (!/run_worker_first\s*=\s*\[[^\]]*"\/__\/auth\/\*"/.test(toml)) problems.push('wrangler.toml run_worker_first lacks /__/auth/*');
if (problems.length) {
  console.error(`check-worker: refusing to deploy: ${problems.join('; ')}.`);
  process.exit(1);
}
console.log('check-worker: worker/index.ts present');
