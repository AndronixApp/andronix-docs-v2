"use client";
// Image attachments, page side (support-chat-images.md §4). Mirrors lib/chat-contract/images.ts
// (kept zod-free for the bundle; render.test.ts checks the copies match).

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const PER_MESSAGE = 2;
export const MAX_INPUT_BYTES = 4 * 1024 * 1024;
/** The page downsizes on a canvas first (speed only; the server re-encodes anyway). */
export const MAX_EDGE = 1568;
/** eve's client won't send an empty message: an image-only send carries this, the Worker drops it. */
export const IMAGE_ONLY_TEXT = "⁣";
export const ATTACH_NOTICE = "Crop out emails, passwords and payment details before you attach a screenshot.";

const MARKER = /\[\[img:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]\]/g;

/** A user message as eve stored it → its text without markers, and the image ids. */
export function splitUserText(text: string): { text: string; imageIds: string[] } {
  const imageIds = [...text.matchAll(MARKER)].map((m) => m[1]!);
  const rest = text.replace(MARKER, "").replaceAll(IMAGE_ONLY_TEXT, "").trim();
  return { text: rest, imageIds };
}

// The Worker's masking patterns (worker/body.ts), applied to assistant text too: a model may
// read an email or order id off a screenshot.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const ORDER_ID = /\bGPA\.[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}(?:\.\.\d+)?\b|\bGPA\.DEV-[A-Z0-9-]+\b/g;
export function maskAssistantText(text: string): string {
  return text.replace(ORDER_ID, "[order id]").replace(EMAIL, (m) => (/^[\w.+-]+@(andronix\.app|docs\.andronix\.app)$/i.test(m) ? m : "[email]"));
}

export type Attachment = {
  localId: string;
  status: "uploading" | "ready" | "failed";
  /** data: URL (the CSP allows data: images, not blob:). */
  preview: string;
  imageId?: string;
  error?: string;
};

const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const isAcceptedType = (type: string) => TYPES.has(type);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}

/**
 * Downsizes to ≤1568 px on a canvas and returns JPEG bytes plus a 64 px preview. Falls back to
 * the original file when the canvas can't decode it (the server still checks and re-encodes).
 */
export async function prepareImage(file: Blob): Promise<{ body: Blob; preview: string }> {
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("canvas");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    const body = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    const p = Math.min(1, 128 / Math.max(w, h));
    const pc = document.createElement("canvas");
    pc.width = Math.max(1, Math.round(w * p)); pc.height = Math.max(1, Math.round(h * p));
    pc.getContext("2d")?.drawImage(canvas, 0, 0, pc.width, pc.height);
    return { body: body && body.size > 0 ? body : file, preview: pc.toDataURL("image/jpeg", 0.7) };
  } catch {
    return { body: file, preview: original.length < 200_000 ? original : "" };
  }
}

export type UploadError = { code: string; error?: string };

export async function uploadImage(token: string, body: Blob): Promise<{ imageId: string; bytes: number; width: number; height: number }> {
  let res: Response;
  try {
    res = await fetch("/chat-api/image", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" }, body, cache: "no-store" });
  } catch {
    throw { code: "upstream", error: "No connection." } satisfies UploadError;
  }
  const text = await res.text();
  if (!res.ok) {
    let b: { code?: string; error?: string } = {};
    try { b = JSON.parse(text); } catch {}
    throw { code: b.code ?? "upstream", error: b.error } satisfies UploadError;
  }
  return JSON.parse(text);
}

export async function deleteImage(token: string, imageId: string): Promise<void> {
  await fetch(`/chat-api/image/${encodeURIComponent(imageId)}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => {});
}

/** Copy for a failed upload. */
export function uploadErrorText(e: UploadError): string {
  switch (e.code) {
    case "image_type": return "Use a PNG, JPEG or WebP screenshot.";
    case "image_too_large": return "That image is too large.";
    case "image_limit": return "You've reached today's image limit.";
    case "rate_minute": return "Too many images at once. Wait a moment.";
    case "cooldown": return "Images are paused for now.";
    default: return "That didn't upload. Try again.";
  }
}
