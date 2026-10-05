#!/usr/bin/env bash
# Fail if credential-shaped literals are committed to tracked source.
#
# The `local-*-change-in-prod` values and a hardcoded local Postgres password sat in
# tracked docs and scripts long enough to be mistaken for real credentials. Nothing
# caught them, so this gate exists to stop the next one landing.
#
# Scans git-tracked, non-vendored text files only, so build output and node_modules
# cannot mask a hit. Usage: ./scripts/scan-secrets.sh   (exit 1 on any match)
set -euo pipefail

cd "$(dirname "$0")/.."

# Files legitimately allowed to contain these literals: the scanner itself defines them.
ALLOW='^(scripts/scan-secrets\.sh)$'

PATTERNS='change-in-prod|cncm_2026_db|sk_(live|test)_[A-Za-z0-9]{16,}|pk_(live|test)_[A-Za-z0-9]{16,}|SUPABASE_SERVICE_ROLE_KEY=[^$"<[:space:]]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

files=$(git ls-files \
  | rg -v '^(node_modules/|\.next/|dist/|build/|\.vercel/|pnpm-lock\.yaml|package-lock\.json)' \
  | rg -v '\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|mp4|webm|pdf|zip|gz|lock)$' \
  | rg -v "$ALLOW" || true)

[ -z "$files" ] && { echo "scan-secrets: no candidate files"; exit 0; }

hits=$(printf '%s\n' "$files" | xargs rg -l --no-messages -e "$PATTERNS" 2>/dev/null || true)

if [ -n "$hits" ]; then
  echo "scan-secrets: credential-shaped literals found in tracked files:" >&2
  printf '  %s\n' $hits >&2
  echo >&2
  echo "  Do not commit secrets. Rotate anything that was ever real, then reference" >&2
  echo "  environment variables (\${VAR}) or clearly-fake placeholders instead." >&2
  exit 1
fi

echo "scan-secrets: clean"
