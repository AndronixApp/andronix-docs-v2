import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export default defineConfig({
  lastModifiedTime: 'git',
});

export const docs = defineDocs({
  dir: 'content/docs',
});
