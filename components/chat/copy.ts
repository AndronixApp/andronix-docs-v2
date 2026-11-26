// Copy that depends on facts still being settled (build plan 2A.2-d: the retention period comes
// from stream A's spike; the privacy paragraph needs the owner's OK). Until then the page makes
// no retention claim.

/** Days chats are kept, from the spike (2A.2-d). null → say nothing about retention. */
export const CHAT_RETENTION_DAYS: number | null = null;

export const DISCLAIMER = [
  "Answers come from an AI and can be wrong.",
  CHAT_RETENTION_DAYS ? `Chats are kept for ${CHAT_RETENTION_DAYS} days.` : "",
  "Never share a password here.",
].filter(Boolean).join(" ");

export const COMPOSER_NOTE = "AI answers can be wrong. For purchases and account questions a person from our team replies by email.";
export const ORDER_ID_HINT = "The order ID goes to our team only. It's in your Google Play receipt email.";
export const MONEY_FOLLOWUP = "That's with the team now. I can still help with installing or using Linux while you wait.";
export const STUCK_FOLLOWUP = "Sorry that didn't do it. Send this to a person so you don't have to explain it again.";
export const SOLVED_FOLLOWUP = "Good to hear.";
