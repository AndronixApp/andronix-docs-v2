import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { SEASON } from '@/lib/season.mjs';
import { SeasonBar, SeasonSidebarCard } from '@/components/season';

export const metadata: Metadata = {
  title: {
    template: '%s - Andronix Docs',
    default: 'Andronix Documentation',
  },
};

export default function RootDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
    {SEASON.active && <SeasonBar id={SEASON.id} />}
    <DocsLayout
      {...baseOptions()}
      tree={source.getPageTree()}
      themeSwitch={{ enabled: false }}
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <div className="flex flex-col gap-2">
          {SEASON.active && <SeasonSidebarCard />}
          <Link
            key="signal-9-banner"
            href="/troubleshooting/signal-9"
            className="group flex items-start gap-2.5 p-3.5 text-sm"
            style={{
              background: "var(--andronix-warn-container)",
              color: "var(--andronix-on-warn-container)",
              borderRadius: "var(--andronix-radius-card)",
            }}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-bold">Signal 9 error in Termux?</span>
              <span className="text-xs opacity-85 group-hover:underline">Read the fix →</span>
            </span>
          </Link>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
    </>
  );
}
