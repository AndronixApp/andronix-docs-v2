"use client";
// The page's calls to the docs Worker (/chat-api/*, build plan 1.4).

import { parseErrorBody, type ErrorBody } from "@/lib/chat-contract/http/http-errors";

export type Me = {
  tier: "free" | "owner" | "staff"; pid: string; verified: boolean; newAccount: boolean;
  limits: { minute: Quota; day: Quota; month: Quota; costDay: { usedMicros: number; maxMicros: number } };
  budget: "normal" | "degrade" | "paused"; rollout: boolean; cooldownUntil?: string | null;
  /** Image attachments (absent on older Workers). */
  images?: { enabled: boolean; perMessage: number; perChat: number; day: { used: number; max: number } };
};
type Quota = { used: number; max: number; resetAt?: string };

export class ChatApiError extends Error {
  constructor(readonly status: number, readonly body: ErrorBody | { ok: false; code: string; error?: string; retryAfter?: number } | null) {
    super(body?.error ?? `HTTP ${status}`);
  }
  get code(): string { return this.body?.code ?? "upstream"; }
}

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  let res: Response;
  try { res = await fetch(path, { ...init, headers, cache: "no-store" }); }
  catch { throw new ChatApiError(0, { ok: false, code: "upstream", error: "No connection." }); }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let body: ChatApiError["body"] = parseErrorBody(text);
    if (!body) { try { body = JSON.parse(text); } catch { body = null; } }
    throw new ChatApiError(res.status, body);
  }
  return JSON.parse(text) as T;
}

export const getMe = (token: string) => call<Me>("/chat-api/me", token);
export const redeem = (code: string, verifier: string) =>
  call<{ customToken: string; entry: "app_help" | "app_install_failed"; reportId?: string }>("/chat-api/redeem", null, { method: "POST", body: JSON.stringify({ code, verifier }) });
export const attachReport = (token: string, sessionId: string, reportId: string) =>
  call<{ ok: true }>("/chat-api/report-attach", token, { method: "POST", body: JSON.stringify({ sessionId, reportId }) });
export const sendFeedback = (token: string, sessionId: string, turnId: string, value: "solved" | "stuck") =>
  call<void>("/chat-api/feedback", token, { method: "POST", body: JSON.stringify({ sessionId, turnId, value }) });
export type TicketInput = { sessionId?: string; reason: "money" | "account" | "stuck" | "user_request" | "limit"; topic?: string; orderId?: string; note?: string; includeChat: boolean; reportId?: string; includeImages?: boolean };
export const fileTicket = (token: string, t: TicketInput) => call<{ ticketRef: string }>("/chat-api/ticket", token, { method: "POST", body: JSON.stringify(t) });

/** chat_id = sha256("chat:" + sessionId)[:16], the same value the Worker sends. */
export async function chatIdFor(sessionId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("chat:" + sessionId));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
