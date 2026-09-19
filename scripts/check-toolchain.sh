#!/usr/bin/env bash
# Toolchain gate: Node >=22 required in CI; explicit dev-only banner locally.
# Usage: ./scripts/check-toolchain.sh [--ci]
set -euo pipefail

MODE="dev"
for arg in "$@"; do
  case "$arg" in
    --ci) MODE="ci" ;;
  esac
done
if [ "${CI:-}" = "true" ]; then MODE="ci"; fi

NODE_BIN="${NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  # Fall back to the well-known Homebrew path on this host.
  [ -x /usr/local/bin/node ] && NODE_BIN=/usr/local/bin/node
fi

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "check-toolchain: FAIL — no node binary found (tried '$NODE_BIN')" >&2
  exit 1
fi

VERSION="$("$NODE_BIN" -v | tr -d 'v')"
MAJOR="${VERSION%%.*}"
echo "check-toolchain: node $VERSION via $NODE_BIN (mode=$MODE)"

if [ "$MAJOR" -ge 22 ] 2>/dev/null; then
  echo "check-toolchain: OK — Node >=22"
  exit 0
fi

MSG="check-toolchain: DEV-ONLY — Node $VERSION < 22 (repo engines: >=22, .nvmrc: 22). Native argon2 disabled; dev fallback hashes in use; tsx/pnpm wrappers may crash. Upgrade with 'nvm use 22' for full fidelity."
if [ "$MODE" = "ci" ]; then
  echo "$MSG" >&2
  echo "check-toolchain: FAIL in CI mode" >&2
  exit 1
fi
echo "$MSG"
exit 0
