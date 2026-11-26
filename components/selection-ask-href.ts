export const SELECTION_MIN = 8;
const MAX = 400;

/** The /chat link for a selection: the passage as the question, cut to the prefill limit. */
export function askHref(text: string): string {
  const q = text.replace(/\s+/g, " ").trim().slice(0, MAX);
  return `/chat#q=${encodeURIComponent(`About this part of the docs: "${q}"`)}&src=docs`;
}

