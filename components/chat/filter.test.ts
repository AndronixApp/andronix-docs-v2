import { test } from "node:test";
import assert from "node:assert/strict";
import { openPanelFilter } from "../../lib/openpanel-filter.mjs";
import { CHAT_PAGE_EVENTS } from "../../lib/chat-contract/page-events.mjs";

function run(href: string, events: { type: string; payload?: { name: string; properties?: Record<string, unknown> } }[], nav: Record<string, unknown> = {}) {
  const url = new URL(href);
  const win: Record<string, unknown> = {};
  const fn = new Function("navigator", "window", "location", "URL", `return (${openPanelFilter(CHAT_PAGE_EVENTS)})`)(nav, win, { pathname: url.pathname, href: url.href, origin: url.origin }, URL);
  const t0 = Date.now;
  const out = events.map((e, i) => { Date.now = () => 1_000_000 + i * 10; try { return { pass: fn(e) as boolean, e }; } finally { Date.now = t0; } });
  return out;
}

test("outside /chat everything passes; DNT/GPC drop everything", () => {
  assert.equal(run("https://docs.andronix.app/use/vnc", [{ type: "track", payload: { name: "link_out" } }])[0].pass, true);
  assert.equal(run("https://docs.andronix.app/use/vnc", [{ type: "track", payload: { name: "x" } }], { globalPrivacyControl: true })[0].pass, false);
});

test("under /chat: only screen_view and chat_* page events; __path/__referrer cut; second view within 3 s dropped", () => {
  const r = run("https://docs.andronix.app/chat", [
    { type: "track", payload: { name: "screen_view", properties: { __path: "https://docs.andronix.app/chat?embed=app#q=my%20email%20a@b.c", __referrer: "https://discord.com/channels/1/2?x=y" } } },
    { type: "track", payload: { name: "screen_view", properties: { __path: "https://docs.andronix.app/chat" } } },
    { type: "track", payload: { name: "link_out", properties: { href: "https://evil.example" } } },
    { type: "track", payload: { name: "copy_code", properties: {} } },
    { type: "track", payload: { name: "chat_opened", properties: { signed_in: true, entry: "docs", surface: "web" } } },
    { type: "identify" },
    { type: "increment" },
  ]);
  assert.deepEqual(r.map((x) => x.pass), [true, false, false, false, true, true, false]);
  assert.equal(r[0].e.payload!.properties!.__path, "https://docs.andronix.app/chat");
  assert.equal(r[0].e.payload!.properties!.__referrer, "https://discord.com/channels/1/2");
});
