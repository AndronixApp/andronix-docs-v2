#!/bin/bash
# Cloudflare Pages build script
# This ensures OpenNext is used instead of the deprecated next-on-pages

echo "Building with OpenNext Cloudflare adapter..."
pnpm run pages:build
