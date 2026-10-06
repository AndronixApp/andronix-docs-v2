import { RiGooglePlayFill } from "react-icons/ri";
import PillLink from "@/components/pill-link";
import { BETA_PLAY_LINK } from "@/lib/beta.mjs";

// "Get Andronix on Google Play": one per install page (the docs home, Start here, Install with
// the app). play.andronix.app redirects to the store listing. In the /beta docs, <PlayLink beta />
// points at the Play open testing link instead. Clicks are counted as play_store_click
// (components/analytics.tsx).
export default function PlayLink({ beta = false, children }: { beta?: boolean; children?: string }) {
  return (
    <div className="not-prose my-6">
      <PillLink href={beta ? BETA_PLAY_LINK : "https://play.andronix.app"} icon={<RiGooglePlayFill className="size-[18px]" />}>
        {children ?? (beta ? "Join the beta on Google Play" : "Get Andronix on Google Play")}
      </PillLink>
    </div>
  );
}
