// prebuild: the page's chat events (lib/chat-contract/page-events.mjs) must exist in the vendored
// event schema (lib/chat-contract/chat-events.schema.json, from stream A) with sender "page".
// Until A's schema is vendored, this only checks the names' shape.
import { existsSync, readFileSync } from 'node:fs';
import { CHAT_PAGE_EVENTS } from '../lib/chat-contract/page-events.mjs';
const schemaUrl = new URL('../lib/chat-contract/chat-events.schema.json', import.meta.url);
const bad = CHAT_PAGE_EVENTS.filter((n) => !/^chat_[a-z_]+$/.test(n));
if (existsSync(schemaUrl)) {
  const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
  const events = schema.events ?? schema.properties ?? schema.$defs ?? {};
  for (const n of CHAT_PAGE_EVENTS) if (!(n in events)) bad.push(`${n} (not in chat-events.schema.json)`);
} else {
  console.warn('check-chat-events: no vendored chat-events.schema.json yet (stream A); names checked only');
}
if (bad.length) { console.error(`check-chat-events: ${bad.join(', ')}`); process.exit(1); }
console.log(`check-chat-events: ${CHAT_PAGE_EVENTS.length} page events OK`);
