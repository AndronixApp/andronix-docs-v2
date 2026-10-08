/**
 * What docs search may send to analytics (docs_search): a short, lower-cased query with nothing personal in it.
 * People sometimes type their own email, phone number or an order/account number into the search box; those
 * queries are replaced by HIDDEN ("(hidden)": OpenPanel drops a value that starts with "["), so the event still counts the search and its results but keeps no personal text.
 * Rules: an email-like or @handle-with-domain string, a phone-like run of 7+ digits (spaces, dashes, dots, brackets
 * and + allowed between them), any run of 6+ digits, or a long token (20+ characters mixing letters and digits) hides the
 * query. Everything else is cut to 40 characters.
 */
export const HIDDEN = "(hidden)";
export const MAX_QUERY = 40;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+|[^\s@]+\s*(@|\(at\)|\[at\])\s*[^\s@]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i;
const PHONE = /\+?\d[\d\s().-]{5,}\d/;
const LONG_NUMBER = /\d{6,}/;
/* 20+ letters/digits in one word, mixing both: an id, key or token, not an English word */
const TOKEN = /(?=[a-z0-9_-]*\d)(?=[a-z0-9_-]*[a-z])[a-z0-9_-]{20,}/i;

export function searchQueryForAnalytics(raw: string): string | null {
  const query = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (query.length < 2) return null;
  const digits = (query.match(/\d/g) ?? []).length;
  if (EMAIL.test(query) || LONG_NUMBER.test(query) || TOKEN.test(query) || (PHONE.test(query) && digits >= 7)) return HIDDEN;
  return query.slice(0, MAX_QUERY);
}
