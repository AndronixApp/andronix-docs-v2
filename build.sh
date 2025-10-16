#!/bin/bash
# Cloudflare Pages build script
# This ensures OpenNext is used instead of the deprecated next-on-pages

echo "Building with OpenNext Cloudflare adapter..."
npx opennextjs-cloudflare build

# Restructure for Cloudflare Pages
echo "Setting up Cloudflare Pages structure..."

# Copy worker to root as _worker.js
cp .open-next/worker.js .open-next/_worker.js

# Move assets to root level (Cloudflare Pages serves from root)
cp -r .open-next/assets/* .open-next/

echo "Build complete!"
