#!/usr/bin/env bash
# build & run the Lightsail stack and smoke-test localhost before the operator flips
# DNS. Safe to re-run after a .env change.
#
# Usage (repo root):
#   bash scripts/lightsail/deploy.sh            # build + up
#   bash scripts/lightsail/deploy.sh --no-build # up only
#   bash scripts/lightsail/deploy.sh --teardown # stop it
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deploy/lightsail"
COMPOSE=(docker compose -f "$DIR/docker-compose.yml" --project-name titan)

cd "$DIR"

if [[ ! -f .env ]]; then
  echo "No .env found at $DIR/.env. Create it from .env.example first." >&2
  exit 1
fi

# Make fill-in mistakes harder to ignore than to fix.
grep -qE '^DOMAIN=' .env || { echo 'DOMAIN is missing in .env' >&2; exit 1; }
grep -qE '^FRONTEND_URL=' .env || { echo 'FRONTEND_URL is missing in .env' >&2; exit 1; }

action="${1:-up}"
case "$action" in
  --no-build) "${COMPOSE[@]}" up -d; exit 0 ;;
  --teardown) "${COMPOSE[@]}" down; exit 0 ;;
esac

echo "> building images (this can take several minutes on a small instance)"
"${COMPOSE[@]}" build --pull

echo "> starting the stack"
"${COMPOSE[@]}" up -d

echo "> waiting for containers..."
sleep 5

# Local smoke tests hit the containers over the compose network, which always works.
# Public smoke tests happen from the operator once DNS is pointed.
echo "> smoke: backend /health"
docker compose -f "$DIR/docker-compose.yml" --project-name titan exec -T backend \
  sh -c 'curl -fsS http://localhost:4000/health' || {
    echo "backend health check failed"; docker compose -f "$DIR/docker-compose.yml" --project-name titan logs --tail=60 backend; exit 1;
  }

echo "> smoke: frontend responds"
docker compose -f "$DIR/docker-compose.yml" --project-name titan exec -T frontend \
  sh -c 'curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:3000/' || {
    echo "frontend did not come up"; "${COMPOSE[@]}" logs --tail=60 frontend; exit 1;
  }

echo ""
echo "> stack is up. Containers all respond locally. Next: DNS."
DOMAIN_VALUE=$(grep '^DOMAIN=' .env | head -1 | sed 's/DOMAIN=//')
echo "  Now set DNS for $DOMAIN_VALUE -> this host's public IP, then:"
echo "    curl -fsS https://$DOMAIN_VALUE/__ping"
echo "    curl -fsS https://$DOMAIN_VALUE/api/proxy/health | head"
echo ""
echo "> compose ps:"
"${COMPOSE[@]}" ps