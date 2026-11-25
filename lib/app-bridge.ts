// The Andronix app ↔ /chat bridge (build plan 1.8, page side).
//
// The app (stream E) injects `window.__ANDRONIX_APP__ = {v: 1, version}` with
// addDocumentStartJavaScript and exposes `AndronixNative` with addWebMessageListener, both only
// for https://docs.andronix.app (debug builds: also their override host) and only to the main
// frame. Messages: page → app `AndronixNative.postMessage(JSON.stringify({id, method, args}))`;
// app → page `replyProxy.postMessage(JSON.stringify({id, result} | {id, error}))`, delivered to
// the `AndronixNative.onmessage` handler. Errors: unsupported | cancelled | failed | unavailable.
// Every call times out after 10 s with `unavailable`, except createReport (the user reads the
// app's consent sheet first): 10 minutes.

export type BridgeError = "unsupported" | "cancelled" | "failed" | "unavailable";
export class AppBridgeError extends Error {
  constructor(readonly code: BridgeError) { super(`app bridge: ${code}`); }
}

type Native = {
  postMessage(message: string): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  addEventListener?(type: "message", fn: (event: { data: unknown }) => void): void;
};
type AppGlobals = { __ANDRONIX_APP__?: { v?: number; version?: string }; AndronixNative?: Native };

const TIMEOUT_MS = 10_000;
const CREATE_REPORT_TIMEOUT_MS = 10 * 60_000;

/** crypto.randomUUID exists only on secure origins; dev http origins get a getRandomValues id. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: AppBridgeError) => void; timer: ReturnType<typeof setTimeout> }>();
let listening: Native | null = null;

const globals = (): AppGlobals => (typeof window === "undefined" ? {} : (window as unknown as AppGlobals));

export function isApp(): boolean {
  const g = globals();
  return !!g.__ANDRONIX_APP__ && g.__ANDRONIX_APP__.v === 1 && !!g.AndronixNative && typeof g.AndronixNative.postMessage === "function";
}

export function appVersion(): string | null {
  const v = globals().__ANDRONIX_APP__?.version;
  return isApp() && typeof v === "string" && v.length <= 32 ? v : null;
}

function onReply(event: { data: unknown }) {
  let msg: { id?: unknown; result?: unknown; error?: unknown };
  try { msg = typeof event.data === "string" ? JSON.parse(event.data) : (event.data as typeof msg); } catch { return; }
  if (!msg || typeof msg.id !== "string") return;
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  clearTimeout(p.timer);
  if (msg.error !== undefined) {
    const code = (["unsupported", "cancelled", "failed", "unavailable"] as const).find((c) => c === msg.error) ?? "failed";
    p.reject(new AppBridgeError(code));
  } else {
    p.resolve(msg.result ?? null);
  }
}

function listen(native: Native) {
  if (listening === native) return;
  listening = native;
  if (typeof native.addEventListener === "function") native.addEventListener("message", onReply);
  else native.onmessage = onReply;
}

function call(method: string, args: Record<string, unknown> = {}, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const native = globals().AndronixNative;
  if (!isApp() || !native) return Promise.reject(new AppBridgeError("unsupported"));
  listen(native);
  const id = newId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new AppBridgeError("unavailable")); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try { native.postMessage(JSON.stringify({ id, method, args })); }
    catch { clearTimeout(timer); pending.delete(id); reject(new AppBridgeError("failed")); }
  });
}

/** The handoff verifier, once per handoff (then `unavailable`). */
export async function handoffVerifier(): Promise<string> {
  const v = await call("handoffVerifier");
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(v)) throw new AppBridgeError("failed");
  return v;
}

/** Shows the app's consent sheet and uploads a report via /v1/reports. */
export async function createReport(): Promise<{ reportId: string }> {
  const v = (await call("createReport", {}, CREATE_REPORT_TIMEOUT_MS)) as { reportId?: unknown } | null;
  if (!v || typeof v.reportId !== "string") throw new AppBridgeError("failed");
  return { reportId: v.reportId };
}

export async function openPlayRating(): Promise<void> { await call("openPlayRating"); }
export async function close(): Promise<void> { await call("close"); }

/**
 * Dev shim (`?shim=app`, dev builds only): defines both globals and answers like the app.
 * `handoffVerifier` answers "dev-verifier-000000000000000" once; `createReport` → AX-FAKE01.
 * Messages from an iframe get no reply, like the app's main-frame-only listener.
 */
export function installDevShim(opts: { verifier?: string } = {}) {
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_CHAT_DEV_SHIM) return;
  if (typeof window === "undefined" || window.top !== window) return;
  const w = window as unknown as AppGlobals;
  let verifier: string | null = opts.verifier ?? "dev-verifier-000000000000000";
  const native: Native = {
    onmessage: null,
    postMessage(raw: string) {
      const { id, method } = JSON.parse(raw) as { id: string; method: string };
      const reply = (body: Record<string, unknown>) => setTimeout(() => native.onmessage?.({ data: JSON.stringify({ id, ...body }) }), 50);
      switch (method) {
        case "handoffVerifier": {
          if (verifier) { reply({ result: verifier }); verifier = null; } else reply({ error: "unavailable" });
          break;
        }
        case "createReport": reply({ result: { reportId: "AX-FAKE01" } }); break;
        case "openPlayRating": case "close": reply({ result: null }); break;
        default: reply({ error: "unsupported" });
      }
    },
  };
  w.__ANDRONIX_APP__ = { v: 1, version: "10.2.4-shim" };
  w.AndronixNative = native;
}
