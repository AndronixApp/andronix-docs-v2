import { EARLY_BIRD_END } from "@/lib/release.mjs";

// When the Modded Pass early-bird price ends (lib/release.mjs), so it's set in
// one place. An ISO time (e.g. 2026-10-06T23:59:00Z) is shown as
// "October 6, 2026, 23:59 UTC"; anything else is shown as written.
export default function EarlyBirdEnd() {
  const t = new Date(EARLY_BIRD_END);
  if (Number.isNaN(t.getTime())) return <>{EARLY_BIRD_END}</>;
  const date = t.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
  const time = t.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return <time dateTime={t.toISOString()}>{`${date}, ${time} UTC`}</time>;
}
