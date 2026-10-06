import { RiGooglePlayFill } from "react-icons/ri";
import { ArrowUpRight } from "lucide-react";
import { BETA_PLAY_LINK } from "@/lib/beta.mjs";

// "Get Andronix on Google Play": one per install page (the docs home, Start here, Install with
// the app). play.andronix.app redirects to the store listing. In the /beta docs, <PlayLink beta />
// points at the Play open testing link instead. Clicks are counted as play_store_click
// (components/analytics.tsx).
export default function PlayLink({ beta = false, children }: { beta?: boolean; children?: string }) {
  return (
    <div className="not-prose my-6">
      <a
        href={beta ? BETA_PLAY_LINK : "https://play.andronix.app"}
        target="_blank"
        rel="noreferrer"
        data-card=""
        className="group inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{
          background: "var(--andronix-surface-high)",
          color: "var(--andronix-on-surface)",
          border: "1px solid var(--andronix-outline)",
          borderRadius: "var(--andronix-radius-full)",
        }}
      >
        <RiGooglePlayFill className="size-[18px] shrink-0" style={{ color: "var(--andronix-primary)" }} aria-hidden />
        <span>{children ?? (beta ? "Join the beta on Google Play" : "Get Andronix on Google Play")}</span>
        <ArrowUpRight className="size-4 shrink-0 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </a>
    </div>
  );
}
