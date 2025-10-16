#!/bin/bash
# Cloudflare Pages build script
# This ensures OpenNext is used instead of the deprecated next-on-pages

echo "Building with OpenNext Cloudflare adapter..."
npx opennextjs-cloudflare build

# Copy worker.js to _worker.js for Cloudflare Pages Advanced Mode
echo "Setting up Cloudflare Pages worker..."
cp .open-next/worker.js .open-next/_worker.js
