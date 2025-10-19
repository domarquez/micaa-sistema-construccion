#!/bin/bash
set -e

echo "🔨 Building MICAA for production..."

# Install all dependencies including devDependencies for build
npm install --include=dev

# Build the application
npm run build

# Create symlink for static files (Railway fix)
echo "Creating symlink for static files..."
rm -rf server/public
ln -sf "$(pwd)/dist/public" server/public

echo "✅ Build completed successfully!"