// Fixed refusal copy and buttons (guardrails §1), mirrored from the vendored contract
// (lib/chat-contract/tools.ts: REFUSAL_COPY, REFUSAL_BUTTONS, refusalKey) so the page doesn't
// bundle zod. components/chat/render.test.ts fails if this differs from the contract.

export type RefusalKey = "offtopic" | "harmful" | "no_answer" | "cooldown";
export type RefusalButton = "open_docs" | "send_to_support" | "handoff_form";

export const REFUSAL_COPY: Record<RefusalKey, string> = {
  offtopic: "I can only help with Andronix and the Linux systems it installs: installing a distro, the desktop, VNC, sound, packages, Termux. I can't help with other topics. The docs cover a lot, and if this is about Andronix and I got it wrong, our support team can help.",
  harmful: "I can't help with that. I can help you install and run Kali and its tools in Andronix, but not use them on systems, networks or accounts that aren't yours.",
  no_answer: "I couldn't find this in the Andronix docs, so I won't guess. Try rephrasing it, or send it to our support team and they'll reply by email.",
  cooldown: "Let's pause here. This assistant only covers Andronix and the Linux systems it installs. You can ask again in {n} minutes.",
};

export const REFUSAL_BUTTONS: Record<RefusalKey, readonly RefusalButton[]> = {
  offtopic: ["open_docs", "send_to_support"],
  harmful: ["open_docs"],
  no_answer: ["handoff_form"],
  cooldown: ["open_docs", "send_to_support"],
};

/** decline.input.reason → copy key: jailbreak uses the off-topic copy. */
export function refusalKey(input: unknown): "offtopic" | "harmful" {
  return (input as { reason?: unknown } | null)?.reason === "harmful" ? "harmful" : "offtopic";
}

export const cooldownText = (retryAfterS: number) => REFUSAL_COPY.cooldown.replace("{n}", String(Math.max(1, Math.ceil(retryAfterS / 60))));
