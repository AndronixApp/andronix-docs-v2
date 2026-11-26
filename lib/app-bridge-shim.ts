// Dev shim for the app bridge (`?shim=app`, dev builds only; loaded with a dynamic import that
// production builds drop). Defines both globals and answers like the app (build plan 1.8).

type Native = { postMessage(message: string): void; onmessage: ((event: { data: unknown }) => void) | null };
type AppGlobals = { __ANDRONIX_APP__?: { v?: number; version?: string }; AndronixNative?: Native };

/**
 * Dev shim (`?shim=app`, dev builds only): defines both globals and answers like the app.
 * `handoffVerifier` answers "dev-verifier-000000000000000" once; `createReport` → AX-FAKE01.
 * Messages from an iframe get no reply, like the app's main-frame-only listener.
 */
export function installDevShim(opts: { verifier?: string } = {}) {
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
