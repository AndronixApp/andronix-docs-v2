import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

// The docs' outbound pill button (Google Play, the Discord beta): an icon in the primary colour,
// the label and an arrow, opening in a new tab.
export default function PillLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-card=""
      className="group inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors"
      style={{
        background: "var(--andronix-surface-high)",
        color: "var(--andronix-on-surface)",
        border: "1px solid var(--andronix-outline)",
        borderRadius: "var(--andronix-radius-full)",
      }}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center" style={{ color: "var(--andronix-primary)" }} aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
      <ArrowUpRight className="size-4 shrink-0 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
    </a>
  );
}
