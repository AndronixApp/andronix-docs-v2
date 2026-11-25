// Firebase Auth's helper pages (/__/auth/handler, /__/auth/iframe, /__/firebase/init.json, ...)
// served from docs.andronix.app: a reverse proxy to <project>.firebaseapp.com. With authDomain set
// to docs.andronix.app the popup/redirect flow stays same-site, which Safari, iOS, Brave and
// in-app browsers (Discord's included) need: they block the third-party storage a
// firebaseapp.com authDomain relies on. Ported from products-api discord/firebaseAuthProxy.ts.
// Firebase's "reverse proxy" option: https://firebase.google.com/docs/auth/web/redirect-best-practices
// No rate limit here (build plan 1.9, review 2 F8). Nothing cached; the body streams both ways.

export const FIREBASE_AUTH_PREFIXES = ["/__/auth/", "/__/firebase/"];

const FORWARD = new Set([
  "accept", "accept-language", "accept-encoding", "content-type", "content-length", "cookie", "user-agent",
  "referer", "origin", "if-none-match", "if-modified-since",
]);
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host",
]);

export function isFirebaseAuthPath(pathname: string): boolean {
  return FIREBASE_AUTH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function firebaseAuthProxy(request: Request, projectId: string): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, `https://${projectId}.firebaseapp.com`);
  const headers = new Headers();
  for (const [k, v] of request.headers) if (FORWARD.has(k.toLowerCase())) headers.set(k, v);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });
  } catch {
    return new Response("sign-in service unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
  const out = new Headers();
  for (const [k, v] of upstream.headers) if (!HOP_BY_HOP.has(k.toLowerCase())) out.append(k, v);
  // The handler pages carry per-request state: never cached by Cloudflare or the browser.
  if (url.pathname.startsWith("/__/auth/")) out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
