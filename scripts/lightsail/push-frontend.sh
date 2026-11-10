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
  # --network=host is load-bearing, not a workaround. BuildKit's default bridge cannot fetch
  # Debian packages on this machine, so the apt layer fails with "Connection failed" against
  # deb.debian.org. It went unnoticed because the layer was cached and only rebuilt after
  # `docker builder prune`. Without the flag a clean build fails here every time.
  docker buildx build --platform linux/amd64 --network=host --load \
    -f apps/frontend/Dockerfile -t "$IMAGE" \
    --build-arg NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://barootcnc.com}" \
    --build-arg NEXT_PUBLIC_DEFAULT_TENANT_SLUG="${NEXT_PUBLIC_DEFAULT_TENANT_SLUG:-cnc-fundamentals}" \
    .
fi

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "No local image $IMAGE" >&2; exit 1; }

# Free space first. `docker load` unpacks the entire image into /var/lib/docker/tmp before it
# imports anything, so a host that is merely "almost full" fails mid-load with
# "no space left on device" and leaves nothing behind. The host never builds — images arrive
# pre-built from this machine — so its build cache is dead weight, and each deploy leaves another
# tagged image behind that nothing references.
#
# This bit the last backend deploy: seven stale frontend tags plus 12 GB of build cache left the
# box with no room, and the transfer died after the gzip had already streamed across.
echo "==> reclaiming space on the host"
# The repository and the tag are interpolated locally: the block below runs in the remote shell,
# where neither is defined, so leaving ${IMAGE...} inside it would expand to an empty string and
# silently match nothing.
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" bash -s -- "$IMAGE" <<'REMOTE_PRUNE'
set -e
KEEP="$1"
REPO="${KEEP%%:*}"
# Keep whatever the running container actually uses, plus the image we are about to send;
# drop every other tag of ours. Nothing else on this box belongs to this repository.
CURRENT=$(docker inspect -f '{{.Config.Image}}' titan-frontend-1 2>/dev/null || true)
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

# The one-shot pipe (`docker save | gzip | ssh 'gunzip | docker load'`) is a single long-lived
# TCP stream, and on this uplink it wedges mid-transfer: one deploy sat at 28 bytes / 10 s for
# two hours with the connection neither closed nor flowing. So the image is shipped as 20 MB
# chunks instead: each chunk is a short-lived scp with SSH keepalives, md5-verified after
# landing and retried individually — a stall costs one chunk, not the whole image. The remote
# `docker load` also runs detached: a dropped control connection used to leave a zombie load
# holding the daemon lock, and every later load queued behind it forever.
PACK_DIR="/tmp/lightsail-deploy.$$"
trap 'rm -rf "$PACK_DIR"' EXIT
mkdir -p "$PACK_DIR"

echo "==> packing image locally"
LOCAL_GZ="$PACK_DIR/image.tar.gz"
docker save "$IMAGE" | gzip -1 > "$LOCAL_GZ"
EXPECTED_MD5=$(md5 -q "$LOCAL_GZ")
split -b 20m "$LOCAL_GZ" "$PACK_DIR/c-"

remote_md5_of() {
  ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" "md5sum /tmp/$1 2>/dev/null | cut -d' ' -f1"
}

for CHUNK in "$PACK_DIR"/c-*; do
  NAME=$(basename "$CHUNK")
  CHUNK_MD5=$(md5 -q "$CHUNK")
  ok=0
  for attempt in 1 2 3 4; do
    echo "==> chunk $NAME (attempt $attempt)"
    if scp -i "$KEY" -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 \
         "$CHUNK" "$HOST:/tmp/$NAME" 2>/dev/null; then
      [ "$(remote_md5_of "$NAME")" = "$CHUNK_MD5" ] && { ok=1; break; }
      echo "    md5 mismatch; resending"
    else
      echo "    scp failed; retrying"
    fi
    sleep $((attempt * 5))
  done
  [[ "$ok" -eq 1 ]] || { echo "Chunk $NAME failed after 4 attempts" >&2; exit 1; }
done

echo "==> remote assemble + load"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" bash -s -- "$IMAGE" "$EXPECTED_MD5" <<'REMOTE_ASSEMBLE'
set -eu
IMAGE="$1"
EXPECTED="$2"
cd /tmp
# Clear any zombie load from an earlier interrupted deploy — it holds the daemon lock and
# every subsequent load silently queues behind it.
pkill -f 'docker load' 2>/dev/null || true
sleep 1
cat c-* > image.tar.gz
if [ "$(md5sum image.tar.gz | cut -d' ' -f1)" != "$EXPECTED" ]; then
  echo "assembled archive md5 mismatch" >&2
  exit 1
fi
nohup sh -c "docker load -i /tmp/image.tar.gz" > /tmp/docker-load.log 2>&1 &
for i in $(seq 1 30); do
  sleep 10
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "    image loaded"
    rm -f /tmp/c-* /tmp/image.tar.gz /tmp/docker-load.log
    exit 0
  fi
  if ! pgrep -f 'docker load' >/dev/null; then
    echo "docker load exited without producing the image:" >&2
    tail -5 /tmp/docker-load.log >&2
    exit 1
  fi
done
echo "docker load did not finish in 5 minutes" >&2
exit 1
REMOTE_ASSEMBLE

echo "==> landed on the host"
ssh "${SSH_OPTS[@]}" "${CONNECT_OPTS[@]}" "$HOST" "docker image inspect '$IMAGE' >/dev/null 2>&1"

if [[ "$PUSH_ONLY" -eq 1 ]]; then
  echo "==> push-only; leaving the running service untouched"
  exit 0
fi

echo "==> syncing sources"
# rsync hands `-e` to a shell, which re-splits it, so the key path needs shell quoting rather
# than a backslash escape. The path is under a directory with a space in its name.
case "$KEY" in
  *"'"*) echo "Key path contains a single quote; set LIGHTSAIL_KEY instead" >&2; exit 2 ;;
esac
rsync_ssh="ssh -i '$KEY' ${CONNECT_OPTS[*]}"
rsync -az --delete \
  -e "$rsync_ssh" \
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
