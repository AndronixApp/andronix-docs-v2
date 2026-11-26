// The "Report AX-… attached" chip (mock 7). It shows as soon as the chat has a report, before the
// first message: the app's handoff (failed install) or the attach card hands the id over at once,
// and the Worker binds it to the session when the first message creates one. Only a bind the
// Worker refused changes it.

export type ReportState = { bound: string | null; pending: string | null; failed: string | null };

export function reportChip(r: ReportState): { text: string; tone: "ok" | "warn" } | null {
  if (r.failed) return { text: `Report ${r.failed} couldn't be attached`, tone: "warn" };
  const id = r.bound ?? r.pending;
  return id ? { text: `Report ${id} attached`, tone: "ok" } : null;
}
