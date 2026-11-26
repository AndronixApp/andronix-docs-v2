// Response helpers shared by the Worker routes.

import { errorBody, type ErrorCode, HTTP_ERRORS } from "../lib/chat-contract/http/http-errors.ts";

const NO_STORE = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const h = new Headers(NO_STORE);
  if (extra) for (const [k, v] of new Headers(extra)) h.set(k, v);
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function fail(code: ErrorCode, retryAfter?: number): Response {
  const body = errorBody(code, retryAfter);
  const extra: Record<string, string> = {};
  if (body.retryAfter !== undefined) extra["retry-after"] = String(body.retryAfter);
  return json(body, HTTP_ERRORS[code].status, extra);
}

export const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/** Reads a JSON body of at most `max` bytes; undefined on anything else. */
export async function readJson(request: Request, max = 16_384): Promise<unknown | undefined> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return undefined;
  const text = await request.text();
  if (text.length > max) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

export const clientIp = (request: Request) => request.headers.get("cf-connecting-ip") ?? "";
