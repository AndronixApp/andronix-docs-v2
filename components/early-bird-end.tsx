import { EARLY_BIRD_END } from "@/lib/release.mjs";

// When the Modded Pass early-bird price ends (lib/release.mjs), so it's set in one place.
export default function EarlyBirdEnd() {
  return <>{EARLY_BIRD_END}</>;
}
