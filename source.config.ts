import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { pageSchema } from 'fumadocs-core/source/schema';
import { andronixTheme } from './lib/shiki-andronix';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: andronixTheme, dark: andronixTheme },
    },
  },
});

export const docs = defineDocs({
  dir: 'content/docs',
  // loose() keeps the extra frontmatter keys lib/seo.ts reads: `date` (blog posts) and
  // `metaTitle` (a search-result title that differs from the page heading).
  docs: { schema: pageSchema.loose() },
});
