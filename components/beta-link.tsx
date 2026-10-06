import type { ReactNode } from "react";
import { BETA_DISCORD, BETA_DISCORD_PLACEHOLDER, BETA_PLAY_LINK, BETA_PLAY_LINK_PLACEHOLDER } from "@/lib/beta.mjs";

// A link from lib/beta.mjs: the Play open testing link or the #standalone-beta Discord invite.
// Until the real link is set, it shows the text with "(link coming soon)".
export default function BetaLink({ to, children }: { to: "play" | "discord"; children: ReactNode }) {
  const [href, placeholder] = to === "play" ? [BETA_PLAY_LINK, BETA_PLAY_LINK_PLACEHOLDER] : [BETA_DISCORD, BETA_DISCORD_PLACEHOLDER];
  if (href === placeholder) return <>{children} (link coming soon)</>;
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}
