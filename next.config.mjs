import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // A separate output folder for local check builds (NEXT_DIST_DIR=.next-check), so a
  // build never touches the .next of a running `next dev`. Deploys use the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // A static export: every page is a file in out/, served by Cloudflare's static
  // assets without running a Worker. Redirects are in public/_redirects
  // (scripts/write-redirects.mjs, from lib/redirects.mjs).
  output: 'export',
  images: { unoptimized: true },
};

export default withMDX(config);

// Initialize OpenNext Cloudflare for development
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
