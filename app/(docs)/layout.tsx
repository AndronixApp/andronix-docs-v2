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
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <Link
            key="signal-9-banner"
            href="/android-12/andronix-on-android-12-and-beyond"
            className="group flex items-start gap-2.5 rounded-lg border border-fd-primary/25 bg-fd-primary/10 p-3 text-sm transition-colors hover:bg-fd-primary/15"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-fd-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-fd-foreground">
                Signal 9 error in Termux?
              </span>
              <span className="text-xs text-fd-muted-foreground group-hover:text-fd-primary">
                Read the fix →
              </span>
            </span>
          </Link>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
