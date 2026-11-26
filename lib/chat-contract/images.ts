/**
 * Image attachments (docs/support-chat-images.md, 2026-11-26). Owner: stream A.
 *
 * Images never become eve file parts (eve keeps `uploadPolicy: "disabled"`, the
 * Worker rejects file parts: QA-1 B5). The Worker stores the re-encoded JPEG
 * and appends one marker per image to the masked message text; the agent's
 * model middleware swaps each marker for the image at call time, fetched from
 * the Worker's internal `/image` route.
 */
import { z } from "zod";

/** One per image, appended by the Worker: `[[img:<uuid v4>]]`. */
export const IMAGE_MARKER = /\[\[img:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]\]/g;
/** Anything that looks like a marker; the Worker strips these from user text before adding its own. */
export const MARKER_LIKE = /\[\[\s*img\s*:[^\]]*\]\]?/gi;

export const IMAGE_LIMITS = {
  perMessage: 2,
  perChat: 4,
  /** Per uid per UTC day, by tier. `new` = new or unverified account. */
  perDay: { free: 4, owner: 12, staff: 50, new: 0 },
  /** Bytes the Worker accepts from the page. */
  maxInputBytes: 4 * 1024 * 1024,
  /** Pixels and aspect ratio, read from the header before any decode. */
  maxInputPixels: 16_000_000,
  maxAspect: 3,
  /** Stored image: JPEG q80, long edge ≤ 1568 px, no metadata. */
  maxEdge: 1568,
  jpegQuality: 80,
} as const;

/** Each image counts as one extra message against the day and month limits. */
export const MESSAGE_COST_PER_IMAGE = 1;

/** What the model sees in place of a marker it can't resolve (deleted, expired, not this chat's). */
export const IMAGE_UNAVAILABLE_TEXT = "[image not available]";

/** Every image id in a text, in order, de-duplicated. */
export function imageIdsIn(text: string): string[] {
  return [...new Set([...text.matchAll(IMAGE_MARKER)].map((m) => m[1]!))];
}

/** Text without image markers (whitespace tidied). */
export function withoutMarkers(text: string): string {
  return text.replace(IMAGE_MARKER, " ").replace(MARKER_LIKE, " ").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export const imageId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

/**
 * POST /chat-api/internal/image (eve → Worker, `x-chat-internal`).
 * The Worker answers only when the image belongs to `uid` and was sent in
 * `sessionId`; otherwise 404. 200 body: `imageResponse`.
 */
export const imageRequest = z
  .object({ uid: z.string().min(1).max(128), sessionId: z.string().min(1).max(128), imageId })
  .strict();
export type ImageRequest = z.infer<typeof imageRequest>;

export const imageResponse = z.object({ mediaType: z.literal("image/jpeg"), dataB64: z.string().min(1).max(3_000_000) }).strict();
export type ImageResponse = z.infer<typeof imageResponse>;

/**
 * POST /eve/v1/andronix/image-reencode (Worker → eve), `x-eve-edge` +
 * `x-chat-internal`, raw image bytes (PNG, JPEG or WebP, ≤ 4 MB).
 * 200: `image/jpeg` bytes with `x-image-width` / `x-image-height`.
 * Errors (JSON `{ok:false, code}`): 401 auth, 413 image_too_large (pixels or
 * aspect), 415 image_type, 422 decode.
 *
 * Spike 2026-11-26: the Cloudflare Images binding kept GPS and EXIF with every
 * option (`metadata: "none"` on transform and on output), so the re-encode
 * runs on `sharp` here (lead decision: sharp fallback in an eve route).
 */
export const REENCODE_PATH = "/eve/v1/andronix/image-reencode" as const;
export const ReencodeError = z.enum(["auth", "image_too_large", "image_type", "decode"]);
