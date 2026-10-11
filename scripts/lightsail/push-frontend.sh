#!/usr/bin/env bash
# Build the frontend image off-box and ship it to Lightsail, reliably.
#
# Why this exists
#
# The frontend must not be built on the 2 GB host: a Next build there has OOM-killed the kernel
# and rebooted the box while it was serving traffic (see docs/ops/DEPLOY_LIGHTSAIL.md). So the
# image is built on a developer machine for linux/amd64 and transferred.
#
# The transfer is the fragile part. Piping `docker save` straight into `ssh docker load` sends
# roughly a quarter of a gigabyte of uncompressed tar over a link that drops without warning, and a
# broken pipe halfway through leaves nothing usable on either side. The transfer is therefore:
#
#   - gzipped, which cuts it to a fraction of the bytes and adds its own integrity check
#   - retried, because a failed attempt is cheap once compressed and a partial one is worthless
#   - verified on the far side before anything is restarted
#
# The image is only switched over once it has actually landed, so a failed push never leaves the
# host without a frontend.
#
# Usage (repo root):
#   bash scripts/lightsail/push-frontend.sh                 # build + push + deploy
#   bash scripts/lightsail/push-frontend.sh --tag my-tag    # choose the tag
#   bash scripts/lightsail/push-frontend.sh --push-only     # do not touch the running service
#   bash scripts/lightsail/push-frontend.sh --skip-build    # reuse an existing local image
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

HOST="${LIGHTSAIL_HOST:-ubuntu@13.206.178.25}"
KEY="${LIGHTSAIL_KEY:-$ROOT/../pem keys/Cnc-ap-south-1.pem}"
REMOTE_DIR="${LIGHTSAIL_DIR:-/opt/titanic/cnc}"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=60 -o TCPKeepAlive=yes)
# A dead link during a long stream is the failure we are defending against, so a short timeout on
# the control connection fails fast into the retry rather than hanging.
CONNECT_OPTS=(-o ConnectTimeout=15 -o ConnectionAttempts=1)

TAG=""
PUSH_ONLY=0
SKIP_BUILD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --push-only) PUSH_ONLY=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$TAG" ]] || TAG="qa-$(date +%Y%m%d%H%M)"
IMAGE="baroot/frontend:$TAG"

echo "==> image: $IMAGE"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  # Cross-building for the host's amd64 from an arm Mac is the whole point: the build never runs
  # on the 2 GB box, only the resulting image does.
  echo "==> building off-box for linux/amd64 (this never runs on the host)"
  docker buildx build --platform linux/amd64 --load \
    -f apps/frontend/Dockerfile -t "$IMAGE" \
    --build-arg NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://barootcnc.com}" \
    --build-arg NEXT_PUBLIC_DEFAULT_TENANT_SLUG="${NEXT_PUBLIC_DEFAULT_TENANT_SLUG:-cnc-fundamentals}" \
    .
fi

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "No local image $IMAGE" >&2; exit 1; }

size=$(docker image inspect "$IMAGE" --format '{{.Size}}')
printf '==> transferring (%.0f MB uncompressed, gzipped on the wire)\n' "$(echo "$size / 1048576" | bc -l)"

attempt=1
max=5
while true; do
  echo "==> push attempt $attempt/$max"
  # gzip gives `set -o pipefail` something to catch a truncated stream, and the remote `gunzip`
  # will refuse to load a corrupt archive rather than loading half an image.
  if docker save "$IMAGE" | gzip -1 | ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" 'gunzip | docker load'; then
    if ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" "docker image inspect '$IMAGE' >/dev/null 2>&1"; then
      echo "==> landed on the host"
      break
    fi
    echo "    transfer reported success but the image is not present; retrying"
  else
    echo "    transfer failed; retrying"
  fi
  attempt=$((attempt + 1))
  [[ "$attempt" -le "$max" ]] || { echo "Giving up after $max attempts" >&2; exit 1; }
  sleep $((attempt * 10))
done

if [[ "$PUSH_ONLY" -eq 1 ]]; then
  echo "==> push-only; leaving the running service untouched"
  exit 0
fi

echo "==> syncing sources"
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]} ${CONNECT_OPTS[*]}" \
  --exclude node_modules --exclude .next --exclude .git --exclude dist \
  --exclude .dev-logs --exclude '.env' --exclude 'deploy/lightsail/logs' \
  ./ "$HOST:$REMOTE_DIR/"

echo "==> switching FRONTEND_IMAGE and recreating only the frontend"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" "
  set -e
  cd '$REMOTE_DIR/deploy/lightsail'
  # Replace the key in place rather than appending: a second FRONTEND_IMAGE line is ambiguous.
  if grep -q '^FRONTEND_IMAGE=' .env; then
    sed -i 's|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=$IMAGE|' .env
  else
    printf 'FRONTEND_IMAGE=%s\n' '$IMAGE' >> .env
  fi
  docker compose up -d --no-build frontend
"

echo "==> waiting for the container"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" \
  "for i in \$(seq 1 30); do
     s=\$(docker inspect -f '{{.State.Status}}' titan-frontend-1 2>/dev/null || echo missing)
     [ \"\$s\" = running ] && { echo '    frontend running'; exit 0; }
     sleep 2
   done
   echo '    frontend did not reach running' >&2
   docker logs --tail 40 titan-frontend-1 2>&1 >&2
   exit 1"

echo "==> done: $IMAGE"
