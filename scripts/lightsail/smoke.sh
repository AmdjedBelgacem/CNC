#!/usr/bin/env bash
# Post-deploy and post-restore checks for the Lightsail stack.
#
# Exists because a restore is exactly when nobody wants to be guessing: it answers
# "is the site actually serving, and is it serving correctly?" in one command, and
# exits non-zero if anything is wrong, so it can gate a restore.
#
# Usage:
#   bash scripts/lightsail/smoke.sh                 # public checks (needs DNS + TLS)
#   bash scripts/lightsail/smoke.sh --local         # loopback only, DNS not required
#   bash scripts/lightsail/smoke.sh --expect-https  # also require the public host
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/deploy/lightsail"
LOCAL_ONLY=0
EXPECT_HTTPS=1
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL_ONLY=1; EXPECT_HTTPS=0 ;;
    --expect-https) EXPECT_HTTPS=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

DOMAIN_VALUE="$(grep '^DOMAIN=' "$DIR/.env" 2>/dev/null | head -1 | sed 's/DOMAIN=//')"
DOMAIN_VALUE="${DOMAIN_VALUE:-barootcnc.com}"
fails=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fails=$((fails + 1)); }
code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$1" 2>/dev/null; }

echo "== containers (project titan)"
if command -v docker >/dev/null 2>&1; then
  while read -r name state; do
    [ -z "$name" ] && continue
    # `{{.State}}` returns "running", while `{{.Status}}` returns "Up 3 minutes" —
    # accept either rather than reporting a healthy stack as down.
    case "$state" in
      Up*|running) printf '  \033[32mPASS\033[0m  %s %s\n' "$name" "$state" ;;
      *)   printf '  \033[31mFAIL\033[0m  %s %s\n' "$name" "$state"; fails=$((fails + 1)) ;;
    esac
  done < <(docker compose -f "$DIR/docker-compose.yml" --project-name titan ps --format '{{.Name}} {{.State}}' 2>/dev/null)
  echo "== only Caddy may publish host ports"
  pub="$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:' | awk '{print $1}' | sort -u | tr '\n' ' ')"
  if [ "$pub" = "titan-caddy-1 " ]; then
    printf '  \033[32mPASS\033[0m  published ports belong to caddy only (%s)\n' "$pub"
  else
    printf '  \033[31mFAIL\033[0m  unexpected published ports: %s\n' "$pub"; fails=$((fails + 1))
  fi
  echo "== internal services must NOT listen on the host"
  if sudo ss -tlnp 2>/dev/null | grep -qE ':(3000|4000|6379|2019) '; then
    fail "an internal service is bound to the host (3000/4000/6379/2019)"
  else
    pass "3000/4000/6379/2019 are container-internal only"
  fi
else
  echo "  SKIP  docker not available on this host"
fi

echo "== application"
if [ "$LOCAL_ONLY" = 1 ]; then
  base="http://127.0.0.1"
else
  base="https://$DOMAIN_VALUE"
  root="$(code "$base/")"
  if [ "$root" = 200 ]; then pass "GET / -> 200"; else fail "GET / -> ${root:-no response}"; fi
  if [ "$EXPECT_HTTPS" = 1 ]; then
    # www must canonicalise to the apex, and never serve its own copy.
    w="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "https://www.$DOMAIN_VALUE/" 2>/dev/null)"
    [ "$w" = 301 ] && pass "www -> 301 (canonical apex)" || fail "www -> ${w:-no response}, expected 301"
  fi
  docs="$(code "$base/api/docs")"
  [ "$docs" = 404 ] && pass "GET /api/docs -> 404 (API docs disabled)" || fail "GET /api/docs -> $docs, expected 404"
fi

health="$(curl -sS --max-time 25 "$base/api/proxy/health" 2>/dev/null)"
echo "  health: $(printf '%s' "$health" | head -c 160)"
case "$health" in
  *'"database":{"state":"up"'*) pass "database up" ;;
  *) fail "database not reported up" ;;
esac
case "$health" in
  *'"auth":{"state":"up"'*) pass "auth up" ;;
  *) fail "auth not reported up" ;;
esac
# Search may legitimately be degraded (Meilisearch is off on purpose); everything
# else must be up, so only complain if an unexpected subsystem is down.
for svc in redis storage email; do
  case "$health" in
    *"\"$svc\":{\"state\":\"up\""*) ;;
    *) fail "$svc not reported up" ;;
  esac
done

echo "== edge headers"
if [ "$LOCAL_ONLY" = 0 ]; then
  hdrs="$(curl -sSI --max-time 25 "$base/" 2>/dev/null)"
  for h in strict-transport-security x-content-type-options x-frame-options referrer-policy; do
    printf '%s' "$hdrs" | grep -qi "$h:" && pass "$h present" || fail "$h missing"
  done
fi

echo
if [ "$fails" = 0 ]; then
  echo "SMOKE OK — every check passed."
else
  echo "SMOKE FAILED — $fails check(s) failed. Treat the deploy or restore as suspect."
fi
exit "$fails"
