import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Metadata } from 'next';

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
      tree={source.pageTree}
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-sm text-orange-600 dark:text-orange-400">
                🚨 Process completed (signal 9) error?
              </span>
              <a
                href="/android-12/andronix-on-android-12-and-beyond"
                className="text-xs text-orange-700 dark:text-orange-300 underline hover:text-orange-900 dark:hover:text-orange-100"
              >
                Read the fix →
              </a>
            </div>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
