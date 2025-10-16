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
      // @ts-expect-error - type mismatch between fumadocs-core and fumadocs-ui
      tree={source.pageTree}
      sidebar={{
        defaultOpenLevel: 1,
      }}
    >
      {children}
    </DocsLayout>
  );
}
