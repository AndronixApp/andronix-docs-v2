import { createMDX } from 'fumadocs-mdx/next';
import { legacyRedirects } from './lib/redirects.mjs';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return legacyRedirects.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default withMDX(config);

// Initialize OpenNext Cloudflare for development
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
