#!/bin/bash
# Deployment script for Winning Edge

set -e

# Install dependencies
npm install

# Build assets (if any build step is needed)
# npm run build

echo "Restarting server with PM2..."
npm run prod:restart

echo "Deployment complete."
