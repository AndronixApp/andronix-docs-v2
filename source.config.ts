import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
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
});
