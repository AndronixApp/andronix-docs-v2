export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={
        "rounded-full inline-flex items-center text-sm dark:bg-orange-500/20 bg-opacity-10 dark:text-orange-400 px-2 py-0.5 ml-2 bg-orange-500/10 text-orange-600"
      }
    >
      {children}
    </span>
  );
}
