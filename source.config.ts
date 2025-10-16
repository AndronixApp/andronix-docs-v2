import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export default defineConfig({
  generateManifest: true,
  lastModifiedTime: 'git',
});

export const docs = defineDocs({
  dir: 'content/docs',
});
