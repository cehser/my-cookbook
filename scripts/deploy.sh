#!/bin/sh
# Deploy my-cookbook via Docker Compose
# Usage: ./scripts/deploy.sh
#
# Passes the current git commit hash to the frontend build
# so it can be displayed on the profile page.

set -e

export COMMIT_HASH=$(git rev-parse --short HEAD)
echo "Deploying commit: $COMMIT_HASH"

docker compose build
docker compose up -d

echo "Deploy complete."
