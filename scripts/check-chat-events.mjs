// prebuild: every event the /chat page sends (lib/chat-contract/page-events.mjs) must be in the
// vendored chat-events.schema.json (stream A) with sender "page"; the OpenPanel allowlist uses
// the same list. Worker events are validated against the schema in worker/dev/integration.test.mjs.
import { existsSync } from 'node:fs';
import { CHAT_PAGE_EVENTS } from '../lib/chat-contract/page-events.mjs';
if (!existsSync(new URL('../lib/chat-contract/chat-events.schema.json', import.meta.url))) {
  console.error('check-chat-events: lib/chat-contract/chat-events.schema.json is missing (run scripts/vendor-chat-contract.mjs)');
  process.exit(1);
}
const { eventSender } = await import('../lib/chat-contract/validate-event.mjs');
const bad = CHAT_PAGE_EVENTS.filter((n) => eventSender(n) !== 'page').map((n) => `${n} (sender ${eventSender(n) ?? 'missing'})`);
if (bad.length) { console.error(`check-chat-events: ${bad.join(', ')}`); process.exit(1); }
console.log(`check-chat-events: ${CHAT_PAGE_EVENTS.length} page events match the schema`);
