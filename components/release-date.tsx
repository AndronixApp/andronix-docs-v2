import { RELEASE_DATE } from "@/lib/release.mjs";

// The Andronix 2.0 release date (lib/release.mjs), so it's set in one place.
export default function ReleaseDate() {
  return <>{RELEASE_DATE}</>;
}
