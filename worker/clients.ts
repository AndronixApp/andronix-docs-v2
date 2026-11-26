// Upstreams the Worker calls: products-api (1.6), the desk (1.7), OpenPanel server events (1.10)
// and the ops webhook. Every call has a timeout; none logs a body or a secret.

import type { Env } from "./env.ts";

const TIMEOUT_MS = 10_000;

async function call(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

const base = (u: string) => u.replace(/\/$/, "");

// ---------- products-api ----------

export type RedeemResult =
  | { ok: true; customToken: string; uid: string; entry: "app_help" | "app_install_failed"; reportId?: string }
  | { ok: false; status: number; code: string };

export async function redeemHandoff(env: Env, code: string, verifier: string): Promise<RedeemResult> {
  if (!env.PRODUCTS_API_URL || !env.CHAT_SERVICE_SECRET) return { ok: false, status: 502, code: "upstream" };
  try {
    const res = await call(`${base(env.PRODUCTS_API_URL)}/v2/chat/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.CHAT_SERVICE_SECRET}` },
      body: JSON.stringify({ code, verifier }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && typeof body.customToken === "string" && typeof body.uid === "string" && (body.entry === "app_help" || body.entry === "app_install_failed")) {
      return { ok: true, customToken: body.customToken, uid: body.uid, entry: body.entry, reportId: typeof body.reportId === "string" ? body.reportId : undefined };
    }
    return { ok: false, status: res.status >= 500 ? 502 : res.status, code: typeof body.code === "string" ? body.code : "upstream" };
  } catch {
    return { ok: false, status: 502, code: "upstream" };
  }
}

export async function fetchAccount(env: Env, uid: string): Promise<{ tier: "free" | "owner"; createdAt: number } | null> {
  if (!env.PRODUCTS_API_URL || !env.CHAT_SERVICE_SECRET) return null;
  try {
    const res = await call(`${base(env.PRODUCTS_API_URL)}/v2/chat/account`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.CHAT_SERVICE_SECRET}` },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { tier?: string; createdAt?: string | number };
    const tier = b.tier === "owner" ? "owner" : "free";
    const createdAt = typeof b.createdAt === "number" ? b.createdAt : Date.parse(String(b.createdAt ?? ""));
    return { tier, createdAt: Number.isFinite(createdAt) ? createdAt : 0 };
  } catch {
    return null;
  }
}

// ---------- desk (chat scope) ----------

export interface HandoffTicket {
  idempotencyKey: string; uid: string; email: string; emailVerified: boolean;
  reason: "money" | "account" | "stuck" | "user_request" | "limit"; topic?: string; reportId?: string;
  orderId?: string; note?: string; transcript?: { role: string; text: string; at: string }[]; pid: string; entry: string;
}

export type ChatReport = { distro: string; de: string; step: string; outcome: string; phone: string; android: string; appVersion: string; installerVersion: string; log: string };

/** With DESK_API_URL unset (preview Worker, dev) a built-in fake desk answers. */
export async function deskHandoff(env: Env, t: HandoffTicket): Promise<{ ticketRef: string } | null> {
  if (!env.DESK_API_URL) return { ticketRef: `FAKE-${t.idempotencyKey.split(":").slice(1).join("-").slice(0, 24) || "1"}` };
  try {
    const res = await call(`${base(env.DESK_API_URL)}/api/agent/chat-handoff`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.DESK_API_KEY ?? ""}` },
      body: JSON.stringify(t),
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { ticketRef?: string };
    return typeof b.ticketRef === "string" ? { ticketRef: b.ticketRef } : null;
  } catch {
    return null;
  }
}

export async function deskReport(env: Env, reportId: string, uid: string): Promise<ChatReport | null> {
  if (!env.DESK_API_URL) {
    // fake desk: reports named AX-FAKE01… belong to anyone; anything else → 404
    if (!/^AX-FAKE\d{2}$/.test(reportId)) return null;
    return { distro: "debian", de: "xfce", step: "extract", outcome: "failed", phone: "Redmi Note 12", android: "14", appVersion: "10.2.4", installerVersion: "2.1.6", log: "E: Sub-process /usr/bin/dpkg returned an error code (1)" };
  }
  try {
    const res = await call(`${base(env.DESK_API_URL)}/api/agent/chat-report`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.DESK_API_KEY ?? ""}` },
      body: JSON.stringify({ reportId, uid }),
    });
    if (res.status !== 200) return null;
    return (await res.json()) as ChatReport;
  } catch {
    return null;
  }
}

// ---------- OpenPanel server events ----------

export type ServerEvent = { name: string; properties: Record<string, string | number | boolean>; profileId?: string };

export async function track(env: Env, e: ServerEvent): Promise<void> {
  if (!env.OPENPANEL_API_URL || !env.OPENPANEL_CLIENT_ID || !env.OPENPANEL_CLIENT_SECRET) return;
  const properties = { ...e.properties, __timestamp: new Date().toISOString() };
  try {
    await call(`${base(env.OPENPANEL_API_URL)}/track`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "openpanel-client-id": env.OPENPANEL_CLIENT_ID,
        "openpanel-client-secret": env.OPENPANEL_CLIENT_SECRET,
        "user-agent": "andronix-docs-chat-worker",
      },
      body: JSON.stringify({ type: "track", payload: { name: e.name, properties, ...(e.profileId ? { profileId: e.profileId } : {}) } }),
    });
  } catch {}
}

// ---------- ops webhook ----------

export async function opsNotify(env: Env, text: string): Promise<void> {
  if (!env.OPS_WEBHOOK_URL) return;
  try {
    await call(env.OPS_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Discord ({content}) and Slack-style ({text}) webhooks both accept this shape.
      body: JSON.stringify({ content: text, text }),
    });
  } catch {}
}
