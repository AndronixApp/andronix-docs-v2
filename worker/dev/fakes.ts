// Dev-only upstreams for the chat Worker (never deployed): fake eve, fake products-api,
// a fake OpenPanel sink. Run with `pnpm chat:fakes` (wrangler dev -c worker/dev/wrangler.fakes.toml).
//
// fake eve replays lib/chat-contract/fixtures/streams/*.ndjson. The fixture comes from the
// first message ("fixture:04 …"), or the default 01. Each POST releases the fixture's next turn.
// It validates incoming requests the way eve would see them from the Worker: x-eve-edge, the
// x-andronix-* headers, and the exact body keys (create {message, operationId?}; follow-up {message,
// idempotencyKey?}; cancel {turnId?}). GET /fake/requests lists what it saw.

import f01 from "../../lib/chat-contract/fixtures/streams/01-answer-code-sources.ndjson";
import f02 from "../../lib/chat-contract/fixtures/streams/02-known-issue.ndjson";
import f03 from "../../lib/chat-contract/fixtures/streams/03-money-gate.ndjson";
import f04 from "../../lib/chat-contract/fixtures/streams/04-unverified-command.ndjson";
import f05 from "../../lib/chat-contract/fixtures/streams/05-offlist-link-image.ndjson";
import f06 from "../../lib/chat-contract/fixtures/streams/06-stuck-handoff.ndjson";
import f07 from "../../lib/chat-contract/fixtures/streams/07-model-error.ndjson";
import f08 from "../../lib/chat-contract/fixtures/streams/08-session-ended.ndjson";
import f09 from "../../lib/chat-contract/fixtures/streams/09-cancelled.ndjson";
import f10 from "../../lib/chat-contract/fixtures/streams/10-multi-tool-long.ndjson";
import f11 from "../../lib/chat-contract/fixtures/streams/11-followup-no-tools.ndjson";
import f12 from "../../lib/chat-contract/fixtures/streams/12-idle-close.ndjson";
import f13 from "../../lib/chat-contract/fixtures/streams/13-decline-offtopic.ndjson";
import f14 from "../../lib/chat-contract/fixtures/streams/14-harmful-session-end.ndjson";
import f15 from "../../lib/chat-contract/fixtures/streams/15-no-answer.ndjson";
import f16 from "../../lib/chat-contract/fixtures/streams/16-gate-unavailable.ndjson";

const FIXTURES: Record<string, string> = { "01": f01, "02": f02, "03": f03, "04": f04, "05": f05, "06": f06, "07": f07, "08": f08, "09": f09, "10": f10, "11": f11, "12": f12, "13": f13, "14": f14, "15": f15, "16": f16 };
const EDGE = "dev-edge-secret";
const SERVICE = "dev-service-secret";

interface Delivery { id: string; source: "channel" | "cancel" | "control"; line: number }
interface Session { id: string; lines: string[]; recorded: number; deliveries: Delivery[]; next: number; released: number; synth: number }
const sessions = new Map<string, Session>();
const requests: unknown[] = [];
const events: unknown[] = [];
const accounts = new Map<string, { tier: "free" | "owner"; createdAt: string }>();
const handoffs = new Map<string, { uid: string; entry: string; verifierHash: string; used: boolean; exp: number; reportId?: string }>();
/** PKCE S256, as products-api stores it: BASE64URL(SHA-256(verifier)), no padding. */
async function s256(verifier: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Fact = { type: string; data?: Record<string, any>; scope?: Record<string, string> };
/** Lines (no $eve transport records) and the delivery each request releases. */
function parseFixture(text: string) {
  const lines = text.split("\n").filter((l) => l.trim() && !l.includes('"$eve"'));
  const deliveries: Delivery[] = [];
  lines.forEach((l, i) => {
    const v = JSON.parse(l) as { facts?: Fact[] };
    for (const f of v.facts ?? []) if (f.type === "delivery.admitted") {
      const src = f.data?.source ?? {};
      deliveries.push({ id: f.data!.deliveryId, source: "channel" in src ? "channel" : src.control === "cancel" ? "cancel" : "control", line: i });
    }
  });
  return { lines, deliveries };
}

/** Releases lines up to the next channel/cancel delivery; control deliveries (end, reset) ride along. */
function releaseNext(s: Session): string {
  const d = s.deliveries[s.next];
  s.next++;
  while (s.next < s.deliveries.length && s.deliveries[s.next].source === "control") s.next++;
  s.released = s.next < s.deliveries.length ? s.deliveries[s.next].line : s.lines.length;
  return d.id;
}

/** A follow-up past the recording: replays the last recorded channel turn with fresh ids. */
function synthesizeTurn(s: Session): string {
  const last = [...s.deliveries].reverse().find((d) => d.source === "channel")!;
  const from = last.line;
  const after = s.deliveries.find((d) => d.line > from);
  const to = after ? after.line : s.recorded;
  const n = ++s.synth;
  const id = crypto.randomUUID();
  // the new turn follows the session's latest turn, as eve records it
  let prevTurn: string | null = null;
  for (const l of s.lines) { const m = /"turnId":"([^"]+)"\},"type":"turn\.started"/.exec(l) ?? /"type":"turn\.started","scope":\{"turnId":"([^"]+)"/.exec(l); if (m) prevTurn = m[1]; }
  const chunk = s.lines.slice(from, to).map((l) => {
    const v = JSON.parse(l) as { at?: string; facts?: Fact[]; progress?: Fact };
    if (v.facts) v.facts = v.facts.filter((f) => f.type !== "session.started" && f.type !== "session.ended");
    return v.facts && !v.facts.length ? null : JSON.stringify(v)
      .replaceAll(last.id, id).replace(/"turn_(\d+)"/g, `"turn_s${n}_$1"`).replace(/"run_(\d+)/g, `"s${n}_run_$1`).replace(/mock-tool-call-/g, `s${n}-call-`);
  }).filter((x): x is string => x !== null).map((l) => {
    if (!l.includes('"turn.started"')) return l;
    const v = JSON.parse(l) as { facts: Fact[] };
    for (const f of v.facts) if (f.type === "turn.started" && f.data) f.data.follows = prevTurn;
    return JSON.stringify(v);
  });
  s.lines.push(...chunk);
  s.released = s.lines.length;
  return id;
}
const j = (b: unknown, status = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...h } });

function checkEdge(req: Request, kind: string, body?: unknown): Response | null {
  const problems: string[] = [];
  if (req.headers.get("x-eve-edge") !== EDGE) problems.push("x-eve-edge");
  if (req.headers.get("x-andronix-erase") !== "1") {
    for (const h of ["x-andronix-tier", "x-andronix-budget", "x-andronix-entry", "x-andronix-surface", "x-andronix-pid"]) if (!req.headers.get(h)) problems.push(h);
    if (!/^Bearer /.test(req.headers.get("authorization") ?? "")) problems.push("authorization");
  }
  requests.push({ kind, path: new URL(req.url).pathname, query: Object.fromEntries(new URL(req.url).searchParams), body, headers: Object.fromEntries([...req.headers].filter(([k]) => k.startsWith("x-andronix-"))), problems });
  return problems.length ? j({ ok: false, code: "unauthorized", error: `fake eve: missing ${problems.join(", ")}` }, 401) : null;
}

function keysExactly(b: unknown, allowed: string[], required: string[]) {
  if (!b || typeof b !== "object") return false;
  const k = Object.keys(b);
  return required.every((r) => k.includes(r)) && k.every((x) => allowed.includes(x));
}

let eraseFails = 0;
const erased: { pid: string; sessionIds: string[] }[] = [];

async function fakeEve(req: Request, url: URL): Promise<Response> {
  const p = url.pathname;
  if (p === "/eve/v1/andronix/erase" && req.method === "POST") {
    // contract/erase.md: edge + internal secret, {pid, sessionIds}; `eraseFails` forces 502s
    if (req.headers.get("x-eve-edge") !== EDGE || req.headers.get("x-chat-internal") !== "dev-internal-secret") return j({ ok: false, code: "auth" }, 401);
    const body = await req.json().catch(() => null) as { pid?: string; sessionIds?: string[] } | null;
    if (!keysExactly(body, ["pid", "sessionIds"], ["pid", "sessionIds"]) || !/^[0-9a-f]{32}$/.test(body!.pid!) || !Array.isArray(body!.sessionIds) || !body!.sessionIds.length || body!.sessionIds.length > 200) return j({ ok: false, code: "bad_body" }, 400);
    const results = body!.sessionIds.map((sessionId) => ({ sessionId, result: eraseFails > 0 ? "failed" : sessions.has(sessionId) ? "ended" : "not_found" }));
    if (eraseFails > 0) { eraseFails--; return j({ ok: false, results }, 502); }
    for (const id of body!.sessionIds) sessions.delete(id);
    erased.push({ pid: body!.pid!, sessionIds: body!.sessionIds });
    return j({ ok: true, results });
  }
  if (p === "/eve/v1/session" && req.method === "POST") {
    const body = await req.json().catch(() => null) as { message?: string } | null;
    const bad = checkEdge(req, "create", body); if (bad) return bad;
    if (!keysExactly(body, ["message", "operationId"], ["message"])) return j({ ok: false, error: "fake eve: create body must be {message, operationId?}" }, 400);
    const n = /fixture:(\d\d)/.exec(body!.message!)?.[1] ?? "01";
    const { lines, deliveries } = parseFixture(FIXTURES[n] ?? f01);
    const id = `wrun_fake_${n}_${crypto.randomUUID().slice(0, 8)}`;
    const s: Session = { id, lines, recorded: lines.length, deliveries, next: 0, released: 0, synth: 0 };
    sessions.set(id, s);
    return j({ ok: true, sessionId: id, deliveryId: releaseNext(s) }, 202, { "x-eve-session-id": id });
  }
  const m = /^\/eve\/v1\/session\/([^/]+)(\/stream|\/cancel|\/end)?$/.exec(p);
  if (!m) return j({ ok: false, error: "not found" }, 404);
  const s = sessions.get(decodeURIComponent(m[1]));
  if (!s) return j({ ok: false, code: "session_not_found", error: "unknown session" }, 404);
  if (!m[2] && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const bad = checkEdge(req, "followup", body); if (bad) return bad;
    if (!keysExactly(body, ["message", "idempotencyKey"], ["message"])) return j({ ok: false, error: "fake eve: follow-up body must be {message, idempotencyKey?}" }, 400);
    const nextChannel = s.deliveries[s.next]?.source === "channel";
    const deliveryId = nextChannel ? releaseNext(s) : synthesizeTurn(s);
    // "[hold]" in the message: the turn stays running (its settle line is withheld), for turn_running tests
    if (String((body as { message?: string }).message ?? "").includes("[hold]")) {
      const idx = s.lines.findIndex((l, i) => i >= s.released - 40 && l.includes('"turn.settled"') && l.includes(deliveryId));
      const settleAt = s.lines.slice(0, s.released).map((l, i) => (l.includes('"turn.settled"') ? i : -1)).filter((i) => i >= 0).at(-1);
      s.released = idx >= 0 ? idx : settleAt ?? s.released;
    }
    return j({ ok: true, sessionId: s.id, deliveryId }, 202, { "x-eve-session-id": s.id });
  }
  if (m[2] === "/cancel" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const bad = checkEdge(req, "cancel", body); if (bad) return bad;
    if (!keysExactly(body, ["turnId"], [])) return j({ ok: false, error: "fake eve: cancel body must be {turnId?}" }, 400);
    const deliveryId = s.deliveries[s.next]?.source === "cancel" ? releaseNext(s) : crypto.randomUUID();
    return j({ ok: true, sessionId: s.id, deliveryId }, 202);
  }
  if (m[2] === "/end" && req.method === "POST") {
    checkEdge(req, "end", await req.json().catch(() => ({})));
    return j({ ok: true, sessionId: s.id, deliveryId: crypto.randomUUID() }, 202);
  }
  if (m[2] === "/stream" && req.method === "GET") {
    const bad = checkEdge(req, "stream"); if (bad) return bad;
    const start = Math.max(0, Number(url.searchParams.get("startIndex") ?? 0));
    const follow = url.searchParams.get("follow") !== "false";
    const headers = {
      "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-eve-stream-format": "ndjson",
      "x-eve-stream-version": "27", "x-eve-session-id": s.id, "x-eve-stream-tail-index": String(s.released - 1),
    };
    const enc = new TextEncoder();
    const delay = Number(url.searchParams.get("delay") ?? 60);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let sent = start;
        let closed = false;
        const push = async (upTo: number) => {
          while (sent < upTo && !closed) {
            controller.enqueue(enc.encode(s.lines[sent] + "\n"));
            sent++;
            if (follow) await new Promise((r) => setTimeout(r, delay));
          }
        };
        await push(s.released);
        if (!follow) { controller.close(); return; }
        // follow: hold the lease and poll for released lines in this request's own context
        // (workerd won't let another request's timers write here); the lease ends after 12 s
        // without new lines (eve: 60 s).
        let idleSince = Date.now();
        let lastBeat = Date.now();
        while (!closed) {
          if (sent < s.released) { await push(s.released); idleSince = Date.now(); }
          if (Date.now() - idleSince > 12_000) break;
          if (Date.now() - lastBeat > 10_000) { lastBeat = Date.now(); try { controller.enqueue(enc.encode('{"$eve":"heartbeat"}\n')); } catch { break; } }
          await new Promise((r) => setTimeout(r, 100));
        }
        closed = true;
        try { controller.enqueue(enc.encode('{"$eve":"stream.lease-ended"}\n')); controller.close(); } catch {}
      },
    });
    return new Response(stream, { status: 200, headers });
  }
  return j({ ok: false, error: "not found" }, 404);
}

// ---- fake products-api (1.6): redeem + account ----
function unsignedCustomToken(uid: string, claims: Record<string, unknown>) {
  // The Auth emulator accepts unsigned custom tokens (alg "none").
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now, exp: now + 3600, iss: "firebase-auth-emulator@example.com", sub: "firebase-auth-emulator@example.com", uid, claims,
  })}.`;
}

async function fakeProducts(req: Request, url: URL): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${SERVICE}`) return j({ ok: false, code: "auth" }, 401);
  const p = url.pathname.replace(/^\/products-api/, "");
  const body = await req.json().catch(() => ({})) as Record<string, string>;
  if (p === "/v2/chat/account") {
    const a = accounts.get(body.uid) ?? { tier: "free", createdAt: "2025-01-01T00:00:00Z" };
    return j(a);
  }
  if (p === "/v2/chat/redeem") {
    const h = handoffs.get(body.code);
    if (!h) return j({ ok: false, code: "code_unknown" }, 404);
    if (h.used) return j({ ok: false, code: "code_used" }, 410);
    if (Date.now() > h.exp) return j({ ok: false, code: "code_expired" }, 410);
    h.used = true; // a wrong verifier burns the code too
    if ((await s256(String(body.verifier ?? ""))) !== h.verifierHash) return j({ ok: false, code: "verifier_mismatch" }, 403);
    return j({ customToken: unsignedCustomToken(h.uid, { chat_entry: h.entry }), uid: h.uid, entry: h.entry, ...(h.reportId ? { reportId: h.reportId } : {}) });
  }
  return j({ ok: false }, 404);
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith("/eve/")) return fakeEve(req, url);
    if (p.startsWith("/products-api/")) return fakeProducts(req, url);
    if (p === "/openpanel/track") { events.push(await req.json().catch(() => null)); return new Response(null, { status: 202 }); }
    // test controls
    if (p === "/fake/requests") return j(req.method === "DELETE" ? (requests.length = 0, []) : requests);
    if (p === "/fake/erase-fail" && req.method === "POST") { eraseFails = Number(url.searchParams.get("n") ?? 1); return j({ eraseFails }); }
    if (p === "/fake/erased") return j(erased);
    if (p === "/fake/events") return j(req.method === "DELETE" ? (events.length = 0, []) : events);
    if (p === "/fake/accounts" && req.method === "POST") {
      const b = await req.json() as Record<string, { tier: "free" | "owner"; createdAt: string }>;
      for (const [uid, a] of Object.entries(b)) accounts.set(uid, a);
      return j({ ok: true });
    }
    if (p === "/fake/handoff" && req.method === "POST") {
      // {uid, entry, code?, verifier?, ttlMs?, reportId?} → {code}; defaults dev-code / dev-verifier
      const b = await req.json() as { uid: string; entry: string; code?: string; verifier?: string; ttlMs?: number; reportId?: string };
      const code = b.code ?? "dev-code-0000000000000000";
      handoffs.set(code, { uid: b.uid, entry: b.entry, verifierHash: await s256(b.verifier ?? "dev-verifier-000000000000000"), used: false, exp: Date.now() + (b.ttlMs ?? 60_000), reportId: b.reportId });
      return j({ code });
    }
    return j({ ok: false, error: "fakes: not found" }, 404);
  },
};
