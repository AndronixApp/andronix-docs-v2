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
  // only /chat imports motion; this lets the bundler keep just the parts it uses
  experimental: { optimizePackageImports: ['motion'] },
  // "Ask the assistant about this" (components/selection-ask*) is off until the chat entry ships:
  // the loader is a client module, so even an unused import would add next/dynamic to every docs
  // page. With the flag off it resolves to an empty server module instead.
  ...(process.env.NEXT_PUBLIC_CHAT_ENTRY === '1'
    ? {}
    : { turbopack: { resolveAlias: { '@/components/selection-ask-loader': './components/selection-ask-off.ts' } } }),
  // Dev only (CHAT_DEV_PROXY=http://127.0.0.1:8799): `next dev` forwards the chat Worker's paths
  // to a local `wrangler dev`, so /chat works same-origin. Never set for builds.
  ...(process.env.CHAT_DEV_PROXY && process.env.NODE_ENV !== 'production'
    ? { devIndicators: false, agentRules: false, async rewrites() { return ['/chat-api/:p*', '/eve/:p*', '/__/:p*'].map((source) => ({ source, destination: `${process.env.CHAT_DEV_PROXY}${source.replace(':p*', ':p*')}` })); } }
    : {}),
};

export default withMDX(config);

// Initialize OpenNext Cloudflare for development
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
