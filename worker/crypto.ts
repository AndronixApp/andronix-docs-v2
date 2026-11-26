// Hashing and constant-time comparison (build plan 1.2). No salt: pid and chat_id are plain hashes.

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** pid = sha256(uid)[:32] */
export const pidFor = async (uid: string) => (await sha256Hex(uid)).slice(0, 32);

/** chat_id = sha256("chat:" + sessionId)[:16] */
export const chatIdFor = async (sessionId: string) => (await sha256Hex("chat:" + sessionId)).slice(0, 16);

/** Constant-time string compare. Hashes both sides first so the length never leaks either. */
export async function safeEqual(a: string | null | undefined, b: string | null | undefined): Promise<boolean> {
  if (!a || !b) return false;
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** `Bearer <secret>` check, constant time. */
export async function bearerMatches(header: string | null, secret: string | undefined): Promise<boolean> {
  if (!header || !secret) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return safeEqual(m?.[1]?.trim(), secret);
}
