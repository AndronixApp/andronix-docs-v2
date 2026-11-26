// A small validator for chat events against the vendored chat-events.schema.json (A's contract):
// required keys, no unknown keys, enums, types, patterns, the entry/surface $refs.
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync(new URL('./chat-events.schema.json', import.meta.url), 'utf8'));
const defs = schema.$defs;
const resolve = (s) => (s && s.$ref ? defs[s.$ref.replace('#/$defs/', '')] : s);
function check(value, s, path, errs) {
  s = resolve(s);
  if (!s) return;
  if (s.const !== undefined && value !== s.const) errs.push(`${path}: not ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(value)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
  const t = s.type;
  if (t === 'string' && typeof value !== 'string') errs.push(`${path}: not a string`);
  if (t === 'boolean' && typeof value !== 'boolean') errs.push(`${path}: not a boolean`);
  if (t === 'integer' && !Number.isInteger(value)) errs.push(`${path}: not an integer`);
  if (t === 'number' && typeof value !== 'number') errs.push(`${path}: not a number`);
  if (s.pattern && typeof value === 'string' && !new RegExp(s.pattern).test(value)) errs.push(`${path}: doesn't match ${s.pattern}`);
  if (t === 'object' || s.properties) {
    if (!value || typeof value !== 'object') { errs.push(`${path}: not an object`); return; }
    for (const r of s.required ?? []) if (!(r in value)) errs.push(`${path}.${r}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (s.properties?.[k]) check(v, s.properties[k], `${path}.${k}`, errs);
      else if (s.additionalProperties === false) errs.push(`${path}.${k}: unknown key`);
    }
  }
}
/** Returns a list of problems ([] when valid). `sender` checks x-sender when given. */
export function validateEvent(name, properties, sender) {
  const d = defs[name];
  if (!d || !name.startsWith('chat_')) return [`${name}: not in chat-events.schema.json`];
  const errs = [];
  if (sender && d['x-sender'] !== sender) errs.push(`${name}: sender is ${d['x-sender']}, not ${sender}`);
  check(properties, d.properties.properties, name, errs);
  return errs;
}
export const eventSender = (name) => defs[name]?.['x-sender'];
