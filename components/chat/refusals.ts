// Fixed refusal copy (guardrails §1). The source of truth is REFUSAL_COPY in the vendored
// contract (lib/chat-contract/tools.ts, stream A); render.test.ts fails if this drifts from it.

export type RefusalKey = "offtopic" | "jailbreak" | "harmful" | "no_answer" | "cooldown";

export const REFUSAL_TEXT: Record<RefusalKey, string> = {
  offtopic: "I can only help with Andronix and the Linux systems it installs: installing a distro, the desktop, VNC, sound, packages, Termux. I can't help with other topics. The docs cover a lot, and if this is about Andronix and I got it wrong, our support team can help.",
  jailbreak: "I can only help with Andronix and the Linux systems it installs: installing a distro, the desktop, VNC, sound, packages, Termux. I can't help with other topics. The docs cover a lot, and if this is about Andronix and I got it wrong, our support team can help.",
  harmful: "I can't help with that. I can help you install and run Kali and its tools in Andronix, but not use them on systems, networks or accounts that aren't yours.",
  no_answer: "I couldn't find this in the Andronix docs, so I won't guess. Try rephrasing it, or send it to our support team and they'll reply by email.",
  cooldown: "Let's pause here. This assistant only covers Andronix and the Linux systems it installs. You can ask again in {n} minutes.",
};

export const cooldownText = (retryAfterS: number) => REFUSAL_TEXT.cooldown.replace("{n}", String(Math.max(1, Math.ceil(retryAfterS / 60))));

export function declineReason(input: unknown): Exclude<RefusalKey, "cooldown" | "no_answer"> {
  const r = (input as { reason?: unknown } | null)?.reason;
  return r === "harmful" || r === "jailbreak" ? r : "offtopic";
}
