#!/bin/bash
set -e

echo "🔨 Building MICAA for production..."

# Install all dependencies including devDependencies for build
npm install --include=dev

# Build the application
npm run build

echo "✅ Build completed successfully!"