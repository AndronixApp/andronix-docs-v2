// Run by `pnpm run deploy`: refuse to go live while the release date is still the placeholder.
import { RELEASE_DATE, RELEASE_DATE_PLACEHOLDER } from '../lib/release.mjs';
if (RELEASE_DATE === RELEASE_DATE_PLACEHOLDER) {
  console.error('check-release-date: set RELEASE_DATE in lib/release.mjs before deploying (it is still the placeholder).');
  process.exit(1);
}
console.log(`check-release-date: ${RELEASE_DATE}`);
