import Link from "next/link";
import { ArrowRight } from "lucide-react";

// "Next: …" card at the end of every journey page (Steps 1 to 4), with an
// optional second link where the path branches.
export default function NextStep({
  href,
  title,
  description,
  or,
}: {
  href: string;
  title: string;
  description?: string;
  or?: { href: string; title: string };
}) {
  return (
    <div className="not-prose my-10 flex flex-col gap-2">
      <Link
        href={href}
        data-card=""
        className="group flex items-center gap-4 px-5 py-4 transition-colors"
        style={{ background: "var(--andronix-primary-container)", color: "var(--andronix-on-primary-container)", borderRadius: "var(--andronix-radius-card)" }}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] opacity-80">Next</span>
          <span className="text-[17px] font-extrabold tracking-[-0.01em]">{title}</span>
          {description && <span className="text-sm opacity-90">{description}</span>}
        </span>
        <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>
      {or && (
        <Link href={or.href} data-card="" className="px-5 text-sm font-semibold" style={{ color: "var(--andronix-primary)" }}>
          or: {or.title} →
        </Link>
      )}
    </div>
  );
}
