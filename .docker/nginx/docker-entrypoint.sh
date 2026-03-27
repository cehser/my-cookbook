#!/bin/sh
set -e

# Inject runtime config into /config.js from environment variables
envsubst '${OIDC_AUTHORITY} ${OIDC_CLIENT_ID}' \
  < /etc/nginx/templates/config.js.template \
  > /usr/share/nginx/html/config.js

echo "Runtime config injected: OIDC_AUTHORITY=${OIDC_AUTHORITY}"

exec "$@"
