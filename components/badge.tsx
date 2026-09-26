export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="ml-1.5 inline-flex h-6 items-center rounded-full px-2.5 align-middle text-[11.5px] font-bold"
      style={{
        background: "var(--andronix-primary-container)",
        color: "var(--andronix-on-primary-container)",
      }}
    >
      {children}
    </span>
  );
}
