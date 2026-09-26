import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// A closed-by-default tonal block, for material that's kept but outdated
// (e.g. walkthrough videos of the Andronix 7 app).
export default function Collapsed({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details
      className="group my-5 not-prose"
      style={{ background: "var(--andronix-surface)", borderRadius: "var(--andronix-radius-card)" }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--andronix-on-surface-variant)" }}
      >
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="px-4 pb-4 [&>div]:my-0">{children}</div>
    </details>
  );
}
