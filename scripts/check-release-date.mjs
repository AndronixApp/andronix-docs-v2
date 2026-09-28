// Run by `pnpm run deploy`: refuse to go live while the release date or the
// early-bird end date (lib/release.mjs) is still its placeholder.
import { RELEASE_DATE, RELEASE_DATE_PLACEHOLDER, EARLY_BIRD_END, EARLY_BIRD_END_PLACEHOLDER } from '../lib/release.mjs';
let bad = false;
if (RELEASE_DATE === RELEASE_DATE_PLACEHOLDER) {
  console.error('check-release-date: set RELEASE_DATE in lib/release.mjs before deploying (it is still the placeholder).');
  bad = true;
}
if (EARLY_BIRD_END === EARLY_BIRD_END_PLACEHOLDER) {
  console.error('check-release-date: set EARLY_BIRD_END in lib/release.mjs before deploying (it is still the placeholder).');
  bad = true;
}
if (bad) process.exit(1);
console.log(`check-release-date: ${RELEASE_DATE}, early bird until ${EARLY_BIRD_END}`);
