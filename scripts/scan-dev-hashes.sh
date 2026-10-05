#!/usr/bin/env bash
# Fail closed if dev-only fallback password hashes exist where they must not.
# Usage:
#   ./scripts/scan-dev-hashes.sh                 # scan local dev DB (informational)
#   ./scripts/scan-dev-hashes.sh --env=prod      # gate: exit 1 if any found
# Requires: DATABASE_URL, psql on PATH.
set -eu

ENV_MODE="dev"
for arg in "$@"; do
  case "$arg" in
    --env=prod) ENV_MODE="prod" ;;
    --env=dev) ENV_MODE="dev" ;;
  esac
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "scan-dev-hashes: DATABASE_URL must be set (e.g. postgresql://USER:PASSWORD@localhost:5432/cncm)" >&2
  exit 2
fi

PSQL_BIN="$(command -v psql 2>/dev/null || true)"
for cand in /opt/homebrew/opt/postgresql@18/bin/psql /usr/local/bin/psql; do
  [ -n "$PSQL_BIN" ] && break
  [ -x "$cand" ] && PSQL_BIN="$cand"
done
if [ -z "$PSQL_BIN" ]; then
  echo "scan-dev-hashes: psql client not found (checked PATH, /opt/homebrew/opt/postgresql@18/bin, /usr/local/bin)" >&2
  exit 2
fi
QUERY="SELECT count(*) FROM users WHERE password_hash LIKE 'fallback-hash:%';"
count="$("$PSQL_BIN" "$DATABASE_URL" -t -A -c "$QUERY" 2>/dev/null || echo QUERY_FAILED)"
count="$(printf '%s' "$count" | tr -d '[:space:]')"
if [ "$count" = "QUERY_FAILED" ] || [ -z "$count" ]; then
  echo "scan-dev-hashes: could not query users table (is DATABASE_URL correct? is psql installed?)" >&2
  exit 2
fi

echo "scan-dev-hashes: $count user row(s) with dev fallback password hashes (env=$ENV_MODE)"

if [ "$ENV_MODE" = "prod" ] && [ "$count" != "0" ]; then
  echo "scan-dev-hashes: REFUSING promotion — dev fallback hashes present in prod-gated DB" >&2
  "$PSQL_BIN" "$DATABASE_URL" -t -A -c "SELECT email FROM users WHERE password_hash LIKE 'fallback-hash:%' LIMIT 20;" >&2 || true
  exit 1
fi
exit 0
