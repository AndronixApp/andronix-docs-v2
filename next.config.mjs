import { createMDX } from 'fumadocs-mdx/next';
import { legacyRedirects, v8Redirects } from './lib/redirects.mjs';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // A separate output folder for local check builds (NEXT_DIST_DIR=.next-check), so a
  // build never touches the .next of a running `next dev`. Deploys use the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [...v8Redirects, ...legacyRedirects].map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default withMDX(config);

// Initialize OpenNext Cloudflare for development
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
