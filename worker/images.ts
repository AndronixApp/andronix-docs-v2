// Image attachments (support-chat-images.md §1, A contract v3 `images.ts`).
//
//   POST   /chat-api/image        raw PNG/JPEG/WebP bytes (≤4 MB) → {imageId, bytes, width, height}
//   DELETE /chat-api/image/:id    remove before (or after) sending
//   POST   /chat-api/internal/image  eve → {mediaType, dataB64} for an image of that uid + session
//
// The page never gets image bytes back: it shows its own local preview. The original upload is
// never stored: eve's sharp route re-encodes it (JPEG q80, ≤1568 px, no metadata) and only that
// goes to R2. Nothing here logs bytes, ids or text.

import { IMAGE_LIMITS, REENCODE_PATH } from "../lib/chat-contract/images.ts";
import { authenticate, chatEnabled, type Caller, type Ctx } from "./context.ts";
import { inImagesRollout } from "./env.ts";
import { fail, json, noContent, readJson } from "./http.ts";
import { track } from "./clients.ts";

const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** PNG, JPEG or WebP by magic bytes only; the browser's content-type and file name are ignored. */
export function sniffImage(b: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

export function bytesBucket(n: number): "<100k" | "100-300k" | "300k+" {
  return n < 100_000 ? "<100k" : n < 300_000 ? "100-300k" : "300k+";
}

export const imageKey = (pid: string, imageId: string) => `${pid}/${imageId}.jpg`;

type Reason = "type" | "size" | "pixels" | "limit" | "tier" | "decode";
function rejected(ctx: Ctx, caller: Caller, reason: Reason) {
  ctx.exec.waitUntil(track(ctx.env, { name: "chat_image_rejected", profileId: caller.pid, properties: { reason, tier: caller.tier, entry: "docs", surface: "web" } }));
}

/** Signed in, chat on, inside both rollouts. */
async function imageCaller(ctx: Ctx, request: Request): Promise<Caller | Response> {
  if (!chatEnabled(ctx.env) || !ctx.env.CHAT_IMAGES) return fail("disabled", 3600);
  const caller = await authenticate(ctx, request);
  if ("error" in caller) return fail(caller.error);
  if (!inImagesRollout(ctx.env.CHAT_IMAGES_ROLLOUT, caller.rollout, caller.tier)) return fail("disabled", 86400);
  return caller;
}

export const imagesEnabledFor = (ctx: Ctx, caller: Caller) => !!ctx.env.CHAT_IMAGES && inImagesRollout(ctx.env.CHAT_IMAGES_ROLLOUT, caller.rollout, caller.tier);

/** Reads at most `max` bytes of the body; null when it's longer. */
async function readBytes(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

/** eve's re-encode route (sharp). Never stores or logs anything. */
async function reencode(ctx: Ctx, bytes: Uint8Array): Promise<{ ok: true; jpeg: Uint8Array; width: number; height: number } | { ok: false; status: number; code: string }> {
  if (!ctx.env.EVE_ORIGIN) return { ok: false, status: 502, code: "upstream" };
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "x-eve-edge": ctx.env.EVE_EDGE_SECRET ?? "",
    "x-chat-internal": ctx.env.CHAT_INTERNAL_SECRET ?? "",
  };
  if (ctx.env.EVE_BYPASS_HEADER) headers["x-vercel-protection-bypass"] = ctx.env.EVE_BYPASS_HEADER;
  try {
    const res = await fetch(`${ctx.env.EVE_ORIGIN.replace(/\/$/, "")}${REENCODE_PATH}`, { method: "POST", headers, body: bytes, signal: AbortSignal.timeout(20_000), redirect: "manual" });
    if (res.status !== 200) {
      const b = (await res.json().catch(() => null)) as { code?: string } | null;
      return { ok: false, status: res.status, code: b?.code ?? "upstream" };
    }
    const jpeg = new Uint8Array(await res.arrayBuffer());
    if (sniffImage(jpeg) !== "jpeg") return { ok: false, status: 502, code: "upstream" };
    return { ok: true, jpeg, width: Number(res.headers.get("x-image-width") || 0), height: Number(res.headers.get("x-image-height") || 0) };
  } catch {
    return { ok: false, status: 502, code: "upstream" };
  }
}

export async function handleImageApi(ctx: Ctx, request: Request, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (p === "/chat-api/image" && request.method === "POST") return upload(ctx, request);
  const m = /^\/chat-api\/image\/([^/]{1,64})$/.exec(p);
  if (m && request.method === "DELETE") return remove(ctx, request, m[1]);
  return null;
}

async function upload(ctx: Ctx, request: Request): Promise<Response> {
  const caller = await imageCaller(ctx, request);
  if (caller instanceof Response) return caller;
  const bytes = await readBytes(request, IMAGE_LIMITS.maxInputBytes);
  if (bytes === null) { rejected(ctx, caller, "size"); return fail("image_too_large"); }
  if (!sniffImage(bytes)) { rejected(ctx, caller, "type"); return fail("image_type"); }
  const admit = await ctx.limiter.call("admitImageUpload", caller.who);
  if (!admit.ok) {
    if (admit.code === "image_limit") rejected(ctx, caller, admit.reason === "tier" ? "tier" : "limit");
    return fail(admit.code, admit.retryAfter);
  }
  const r = await reencode(ctx, bytes);
  if (!r.ok) {
    await ctx.limiter.call("refundImageUpload", caller.who.uid);
    if (r.code === "image_too_large") { rejected(ctx, caller, "pixels"); return fail("image_too_large"); }
    if (r.code === "image_type") { rejected(ctx, caller, "type"); return fail("image_type"); }
    if (r.code === "decode") { rejected(ctx, caller, "decode"); return fail("image_type"); }
    return fail("upstream");
  }
  const imageId = crypto.randomUUID();
  const key = imageKey(caller.pid, imageId);
  try {
    await ctx.env.CHAT_IMAGES!.put(key, r.jpeg, { httpMetadata: { contentType: "image/jpeg" } });
  } catch {
    await ctx.limiter.call("refundImageUpload", caller.who.uid);
    return fail("upstream");
  }
  await ctx.limiter.call("registerImage", caller.who.uid, imageId, { key, bytes: r.jpeg.byteLength, width: r.width, height: r.height });
  return json({ imageId, bytes: r.jpeg.byteLength, width: r.width, height: r.height });
}

async function remove(ctx: Ctx, request: Request, imageId: string): Promise<Response> {
  if (!IMAGE_ID.test(imageId)) return fail("bad_body");
  // removing works outside the images rollout too, so nothing gets stuck
  if (!chatEnabled(ctx.env)) return fail("disabled", 3600);
  const caller = await authenticate(ctx, request);
  if ("error" in caller) return fail(caller.error);
  const r = await ctx.limiter.call("removeImage", caller.who.uid, imageId);
  if (!r.ok) return fail(r.code);
  return noContent();
}

/** eve → Worker: the bytes of an image sent by `uid` in `sessionId`, else 404. */
export async function internalImage(ctx: Ctx, request: Request): Promise<Response> {
  const b = (await readJson(request, 1024)) as Record<string, unknown> | undefined;
  const isStr = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  if (!b || Object.keys(b).some((k) => !["uid", "sessionId", "imageId"].includes(k)) || !isStr(b.uid, 128) || !isStr(b.sessionId, 128) || typeof b.imageId !== "string" || !IMAGE_ID.test(b.imageId)) {
    return fail("bad_body");
  }
  const notFound = () => json({ ok: false, code: "not_found", error: "Image not available." }, 404);
  if (!ctx.env.CHAT_IMAGES) return notFound();
  const found = await ctx.limiter.call("imageFor", b.uid as string, b.sessionId as string, b.imageId);
  if (!found) return notFound();
  const obj = await ctx.env.CHAT_IMAGES.get(found.key);
  if (!obj) return notFound();
  return json({ mediaType: "image/jpeg", dataB64: toBase64(new Uint8Array(await obj.arrayBuffer())) });
}

/** For the desk: the session's images that may go with a ticket, as {mediaType, dataB64}. */
export async function ticketImages(ctx: Ctx, uid: string, sessionId: string): Promise<{ mediaType: "image/jpeg"; dataB64: string }[]> {
  if (!ctx.env.CHAT_IMAGES) return [];
  const list = await ctx.limiter.call("ticketImages", uid, sessionId);
  const out: { mediaType: "image/jpeg"; dataB64: string }[] = [];
  for (const { key } of list) {
    const obj = await ctx.env.CHAT_IMAGES.get(key);
    if (obj) out.push({ mediaType: "image/jpeg", dataB64: toBase64(new Uint8Array(await obj.arrayBuffer())) });
  }
  return out;
}

/** Account erase: every object under the uid's pid prefix (the DO's records are dropped separately). */
export async function eraseImagePrefix(ctx: Ctx, pid: string): Promise<void> {
  const bucket = ctx.env.CHAT_IMAGES;
  if (!bucket) return;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${pid}/`, cursor, limit: 1000 });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function imageAttachedEvent(ctx: Ctx, caller: Caller, count: number, bytes: number, entry: string, surface: string) {
  ctx.exec.waitUntil(track(ctx.env, {
    name: "chat_image_attached", profileId: caller.pid,
    properties: { count, bytes_bucket: bytesBucket(bytes), tier: caller.tier, entry, surface },
  }));
}
