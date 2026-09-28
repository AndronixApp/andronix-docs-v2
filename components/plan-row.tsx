// A plan name with its icon (icon-2.0/plans, 48 dp): the dark variant on
// dark surfaces, the light one on light. The docs are dark-only today; the
// light variant is there if that changes. The icon is decorative: the plan's
// name is in the text next to it.
export default function PlanRow({
  plan,
  children,
}: {
  plan: "paid" | "premium" | "pass" | "complete";
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-3 flex items-center gap-3 leading-relaxed" style={{ color: "var(--andronix-on-surface-variant)" }}>
      <img src={`/images/plans/plan-${plan}-dark.svg`} width={48} height={48} alt="" className="m-0 hidden shrink-0 dark:block" />
      <img src={`/images/plans/plan-${plan}-light.svg`} width={48} height={48} alt="" className="m-0 shrink-0 dark:hidden" />
      <div className="min-w-0 [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-[var(--andronix-on-surface)]">{children}</div>
    </div>
  );
}
