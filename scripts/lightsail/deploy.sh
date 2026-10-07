#!/usr/bin/env bash
# build & run the Lightsail stack and smoke-test localhost before the operator flips
# DNS. Safe to re-run after a .env change.
#
# Usage (repo root):
#   bash scripts/lightsail/deploy.sh            # build + up
#   bash scripts/lightsail/deploy.sh --no-build # up only
#   bash scripts/lightsail/deploy.sh --teardown # stop it
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/deploy/lightsail"
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
  node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || {
    echo "backend health check failed"; docker compose -f "$DIR/docker-compose.yml" --project-name titan logs --tail=60 backend; exit 1;
  }

echo "> smoke: frontend responds"
docker compose -f "$DIR/docker-compose.yml" --project-name titan exec -T frontend \
  node -e "fetch('http://localhost:3000/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" || {
    echo "frontend did not come up"; "${COMPOSE[@]}" logs --tail=60 frontend; exit 1;
  }

echo ""
echo "> stack is up. Containers all respond locally. Next: DNS."
DOMAIN_VALUE=$(grep '^DOMAIN=' .env | head -1 | sed 's/DOMAIN=//')
echo "  Caddy is now serving locally. Check it via the loopback with the right Host"
echo "  header before DNS is live:"
echo "    curl -s -H \"Host: $DOMAIN_VALUE\" http://127.0.0.1/__ping"
echo "    curl -s -H \"Host: $DOMAIN_VALUE\" http://127.0.0.1/api/proxy/health | head -c 300"
echo "  Once DNS points at this host and Let's Encrypt has issued, drop the Host header:"
echo "    curl -fsS https://$DOMAIN_VALUE/__ping"
echo "    curl -fsS https://$DOMAIN_VALUE/api/proxy/health | head -c 300"
echo ""
echo "> compose ps:"
"${COMPOSE[@]}" ps