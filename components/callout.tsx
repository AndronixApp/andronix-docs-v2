import type { ReactNode } from "react";
import { CircleCheck, CircleX, Info, Lightbulb, TriangleAlert } from "lucide-react";

// Andronix 2.0 callouts: soft tonal blocks, no border or shadow. Each type
// uses a container colour and its on-* partner from andronix-tokens.css.
const types = {
  info: { bg: "var(--andronix-surface)", fg: "var(--andronix-on-surface-variant)", icon: "var(--andronix-primary)", Icon: Info },
  warning: { bg: "var(--andronix-warn-container)", fg: "var(--andronix-on-warn-container)", icon: "var(--andronix-on-warn-container)", Icon: TriangleAlert },
  error: { bg: "var(--andronix-error-container)", fg: "var(--andronix-on-error-container)", icon: "var(--andronix-on-error-container)", Icon: CircleX },
  success: { bg: "var(--andronix-ok-container)", fg: "var(--andronix-on-ok-container)", icon: "var(--andronix-on-ok-container)", Icon: CircleCheck },
  idea: { bg: "var(--andronix-tertiary-container)", fg: "var(--andronix-on-tertiary-container)", icon: "var(--andronix-on-tertiary-container)", Icon: Lightbulb },
};

const aliases: Record<string, keyof typeof types> = { warn: "warning", tip: "info" };

export function Callout({
  type = "info",
  title,
  icon,
  children,
}: {
  type?: string;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const t = types[(aliases[type] ?? type) as keyof typeof types] ?? types.info;
  return (
    <div
      className="andronix-callout my-5 flex gap-3 px-4 py-3.5 text-[0.9375rem] leading-relaxed"
      style={{ background: t.bg, color: t.fg, borderRadius: "var(--andronix-radius-card)" }}
    >
      <span className="mt-[3px] shrink-0 [&_svg]:size-[18px]" style={{ color: t.icon }}>
        {icon ?? <t.Icon strokeWidth={2.25} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && <p className="my-0! font-bold" style={{ color: "inherit" }}>{title}</p>}
        <div className="prose-no-margin andronix-callout-body empty:hidden">{children}</div>
      </div>
    </div>
  );
}
