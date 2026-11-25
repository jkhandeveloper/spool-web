#!/usr/bin/env bash
# Builds the dashboard against the production API and publishes it to the droplet.
# Usage (from the repo root): ./deploy/deploy.sh
# Needs the `spool-deploy` SSH host alias (see spool-api DEPLOY.md).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_TARGET:-spool-deploy}"
API_URL="${VITE_API_URL:-https://api.spoolapp.net/api/v1}"
RELEASE="$(date -u +%Y%m%d%H%M%S)"

VITE_API_URL="$API_URL" npm run build

ssh "$HOST" "mkdir -p /opt/spool-web/releases/$RELEASE"
scp -rq dist/. "$HOST:/opt/spool-web/releases/$RELEASE/"
# Swap the symlink atomically, then keep the 5 newest releases.
ssh "$HOST" "cd /opt/spool-web && chmod -R a+rX releases/$RELEASE \
  && ln -sfn releases/$RELEASE current.tmp && mv -Tf current.tmp current \
  && ls -1dt releases/* | tail -n +6 | xargs -r rm -rf"
echo "Deployed release $RELEASE to $HOST:/opt/spool-web/current"
