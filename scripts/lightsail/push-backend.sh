#!/usr/bin/env bash
# Build the backend image off-box and ship it to Lightsail.
#
# The 2 GB host cannot safely compile the backend: a host-side build needs the
# full toolchain, runs the kernel out of memory, and has taken the site down
# while the deploy was still in progress. The image is therefore built on a
# developer machine for linux/amd64 and transferred, exactly like the frontend
# (see push-frontend.sh and docs/ops/DEPLOY_LIGHTSAIL.md).
#
# Usage (repo root):
#   bash scripts/lightsail/push-backend.sh                 # build + push + deploy
#   bash scripts/lightsail/push-backend.sh --tag my-tag    # choose the tag
#   bash scripts/lightsail/push-backend.sh --push-only     # do not touch the running service
#   bash scripts/lightsail/push-backend.sh --skip-build    # reuse an existing local image
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

HOST="${LIGHTSAIL_HOST:-ubuntu@13.206.178.25}"
KEY="${LIGHTSAIL_KEY:-$ROOT/../pem keys/Cnc-ap-south-1.pem}"
REMOTE_DIR="${LIGHTSAIL_DIR:-/opt/titanic/cnc}"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=60 -o TCPKeepAlive=yes)
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
IMAGE="baroot/backend:$TAG"

echo "==> image: $IMAGE"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> building off-box for linux/amd64 (this never runs on the host)"
  # --network=host is load-bearing on this machine: BuildKit's default bridge
  # cannot fetch Debian packages, which makes the apt layer fail on a clean build.
  docker buildx build --platform linux/amd64 --network=host --load \
    -f Dockerfile -t "$IMAGE" .
fi

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "No local image $IMAGE" >&2; exit 1; }

echo "==> reclaiming space on the host"
# Keep the running image and the one we are about to send; drop every other
# backend tag and the host's build cache. The host never builds now, so its
# cache is dead weight and each deploy otherwise leaves another 1.3 GB image
# behind. The host has run out of disk mid-transfer before.
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" bash -s -- "$IMAGE" <<'REMOTE_PRUNE'
set -e
KEEP="$1"
REPO="${KEEP%%:*}"
CURRENT=$(docker inspect -f '{{.Config.Image}}' titan-backend-1 2>/dev/null || true)
for img in $(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${REPO}:" || true); do
  if [ "$img" != "$CURRENT" ] && [ "$img" != "$KEEP" ]; then
    docker rmi "$img" >/dev/null 2>&1 || true
  fi
done
docker builder prune -af >/dev/null 2>&1 || true
df -h / | tail -1
REMOTE_PRUNE

size=$(docker image inspect "$IMAGE" --format '{{.Size}}')
printf '==> transferring (%.0f MB uncompressed, gzipped on the wire)\n' "$(echo "$size / 1048576" | bc -l)"

attempt=1
max=5
while true; do
  echo "==> push attempt $attempt/$max"
  # gzip gives the pipeline an integrity check, so a truncated stream is
  # rejected by gunzip instead of loading half an image.
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
# Keep the host checkout current for future on-box operations. `--delete` is
# safe here because secrets are excluded and the image is already transferred:
# nothing under the excluded paths is needed to start the service.
case "$KEY" in
  *"'"*) echo "Key path contains a single quote; set LIGHTSAIL_KEY instead" >&2; exit 2 ;;
esac
rsync_ssh="ssh -i '$KEY' ${CONNECT_OPTS[*]}"
rsync -az --delete \
  -e "$rsync_ssh" \
  --exclude node_modules --exclude .next --exclude .git --exclude dist \
  --exclude .dev-logs --exclude '.env' --exclude 'deploy/lightsail/logs' \
  ./ "$HOST:$REMOTE_DIR/"

echo "==> switching BACKEND_IMAGE and recreating only the backend"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" "
  set -e
  cd '$REMOTE_DIR/deploy/lightsail'
  if grep -q '^BACKEND_IMAGE=' .env; then
    sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=$IMAGE|' .env
  else
    printf 'BACKEND_IMAGE=%s\n' '$IMAGE' >> .env
  fi
  docker compose --project-name titan up -d --no-build backend
"

echo "==> waiting for the backend"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" \
  "for i in \$(seq 1 60); do
     s=\$(docker inspect -f '{{.State.Status}}' titan-backend-1 2>/dev/null || echo missing)
     if [ \"\$s\" = running ]; then
       docker compose --project-name titan exec -T backend \\
         node -e \"fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\" \\
         && { echo '    backend healthy'; exit 0; }
     fi
     sleep 2
   done
   echo '    backend did not become healthy' >&2
   docker logs --tail 60 titan-backend-1 2>&1 >&2
   exit 1"

echo "==> done: $IMAGE"
