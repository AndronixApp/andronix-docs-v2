import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: {
    template: '%s - Andronix Docs',
    default: 'Andronix Documentation',
  },
};

export default function RootDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions()}
      tree={source.getPageTree()}
      themeSwitch={{ enabled: false }}
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <Link
            key="signal-9-banner"
            href="/android-12/andronix-on-android-12-and-beyond"
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
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
