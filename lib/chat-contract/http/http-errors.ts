// Support chat: the Worker's error codes (build plan 1.4.1, canonical). Stream B owns this file.
// Every Worker error body is { ok: false, code, error, retryAfter? }; 429 and 503 always carry
// retryAfter (seconds). The page maps `code` to the limit cards of mock 8.

export const HTTP_ERRORS = {
  auth: { status: 401, error: "Sign in again to keep chatting." },
  not_owner: { status: 403, error: "This chat belongs to another account." },
  bad_body: { status: 400, error: "The request had fields the chat doesn't accept." },
  message_too_long: { status: 400, error: "Messages can be up to 2,000 characters." },
  chat_full: { status: 409, error: "This chat is full. Start a new chat." },
  turn_running: { status: 409, error: "Wait for the current answer to finish." },
  rate_minute: { status: 429, error: "You're sending messages quickly. Wait a moment." },
  rate_day: { status: 429, error: "You've reached today's message limit." },
  rate_month: { status: 429, error: "You've reached this month's message limit." },
  cost_day: { status: 429, error: "You've reached today's limit." },
  new_account: { status: 429, error: "New and unverified accounts have a lower daily limit." },
  new_ip: { status: 429, error: "Too many new accounts from this network today." },
  ip: { status: 429, error: "Too many requests from this network. Wait a minute." },
  streams: { status: 429, error: "Too many open chats. Close one and try again." },
  tickets: { status: 429, error: "You've sent the most support requests for today." },
  handoff_rate: { status: 429, error: "Too many chat openings from the app. Try again later." },
  budget_paused: { status: 503, error: "The assistant is paused for today." },
  disabled: { status: 503, error: "The assistant isn't available right now." },
  upstream: { status: 502, error: "Something went wrong. Try again." },
  // guardrails §2: strikes for off-topic / jailbreak / harmful turns lead to a per-account pause
  cooldown: { status: 429, error: "Let's pause here. This assistant only covers Andronix and the Linux systems it installs." },
} as const;

export type ErrorCode = keyof typeof HTTP_ERRORS;

export type ErrorBody = { ok: false; code: ErrorCode; error: string; retryAfter?: number };

export const LIMIT_CODES: readonly ErrorCode[] = [
  "rate_minute", "rate_day", "rate_month", "cost_day", "new_account", "new_ip", "ip",
  "streams", "tickets", "handoff_rate", "budget_paused", "disabled", "cooldown",
];

export function errorBody(code: ErrorCode, retryAfter?: number): ErrorBody {
  const { status, error } = HTTP_ERRORS[code];
  const needsRetry = status === 429 || status === 503;
  const body: ErrorBody = { ok: false, code, error };
  if (needsRetry) body.retryAfter = Math.max(1, Math.ceil(retryAfter ?? 60));
  return body;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(HTTP_ERRORS, value);
}

/** Reads a Worker error from a fetch Response body (text) or from eve's ClientError (`.code`, `.body`). */
export function parseErrorBody(text: string): ErrorBody | null {
  try {
    const v = JSON.parse(text);
    if (v && v.ok === false && isErrorCode(v.code)) return v as ErrorBody;
  } catch {}
  return null;
}
