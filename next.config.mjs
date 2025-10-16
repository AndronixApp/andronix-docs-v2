import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/blog/v7-0/',
        destination: '/blog/andronix-v7',
        permanent: true,
      },
      {
        source: '/blog/v6-0/',
        destination: '/blog/andronix-v6',
        permanent: true,
      },
      {
        source: '/blog/andronix-termux-and-f-droid/',
        destination: '/blog/andronix-termux-and-f-droid',
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);

// Initialize OpenNext Cloudflare for development
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
