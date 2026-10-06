import { RiDiscordFill } from "react-icons/ri";
import PillLink from "@/components/pill-link";

// "Join the beta on Discord" on the docs home ("Help us test what's next"): testers get access
// with a tester button in #start-here on chat.andronix.app.
export default function DiscordBetaLink() {
  return (
    <div className="not-prose my-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <PillLink href="https://chat.andronix.app" icon={<RiDiscordFill className="size-[18px]" />}>
        Join the beta on Discord
      </PillLink>
      <span className="text-sm" style={{ color: "var(--andronix-on-surface-variant)" }}>
        Tap a tester button in #start-here to get access.
      </span>
    </div>
  );
}
