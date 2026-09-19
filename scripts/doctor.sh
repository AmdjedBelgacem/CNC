#!/usr/bin/env bash
# One-command local stack health check. Fails loudly with actionable errors.
# Usage: ./scripts/doctor.sh
# Env overrides: API_BASE (default http://localhost:4000),
#   SITE_BASE (default http://localhost:3000),
#   S3_ENDPOINT (default http://localhost:9002), S3_BUCKET (default titans-local),
#   TENANT_SLUG (default cnc-fundamentals)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="${API_BASE:-http://localhost:4000}"
SITE_BASE="${SITE_BASE:-http://localhost:3000}"
S3_ENDPOINT="${S3_ENDPOINT:-}"   # resolved in the minio section: env > apps/backend/.env > probe
S3_BUCKET="${S3_BUCKET:-titans-local}"
TENANT_SLUG="${TENANT_SLUG:-cnc-fundamentals}"

PASS=0
FAIL=0
WARN=0

ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ FAIL: $1" >&2; [ -n "${2:-}" ] && echo "    → fix: $2" >&2; }
warn() { WARN=$((WARN+1)); echo "  ! WARN: $1${2:+ → $2}"; }

section() { echo ""; echo "== $1 =="; }

section "env vars"
for v in DATABASE_URL REDIS_URL AUTH_SECRET JWT_ACCESS_SECRET JWT_REFRESH_SECRET S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET; do
  if [ -n "${!v:-}" ]; then ok "$v set"; else warn "$v not set in shell (backend may still read apps/backend/.env)" ; fi
done

section "toolchain"
if "$ROOT/scripts/check-toolchain.sh" >/tmp/doctor-toolchain.log 2>&1; then
  ok "toolchain ($(cat /tmp/doctor-toolchain.log | head -n1))"
else
  fail "toolchain check failed" "run ./scripts/check-toolchain.sh; needs Node >=22 in CI (see .nvmrc)"
fi

section "postgres (via backend)"
if curl -s -m 8 "$API_BASE/tenants" -H "x-tenant-slug: $TENANT_SLUG" | grep -q '"slug"'; then
  ok "backend reachable, tenants listed"
else
  fail "backend not reachable at $API_BASE/tenants" "start backend per docs/LOCAL_DEV.md; check /tmp/cnc.log"
fi

section "schema drift probe (lessons.thumbnail_url)"
LESSON_CODE="$(curl -s -m 10 -o /tmp/doctor-lesson.json -w "%{http_code}" "$API_BASE/courses/cnc-milling-fundamentals/lessons/what-is-cnc" -H "x-tenant-slug: $TENANT_SLUG")"
if [ "$LESSON_CODE" = "200" ]; then
  if grep -q "thumbnailUrl" /tmp/doctor-lesson.json 2>/dev/null; then
    ok "lesson fetch 200 with thumbnailUrl field"
  else
    fail "lesson fetch 200 but no thumbnailUrl field" "rebuild backend (pnpm --filter backend build) and restart; run migrations 005/006"
  fi
elif [ "$LESSON_CODE" = "404" ]; then
  warn "demo lesson not seeded (404)" "run seed per docs/SEEDING.md"
else
  fail "lesson fetch HTTP $LESSON_CODE (want 200; 500 = schema drift)" "check backend log; ensure migrations 005/006 applied to the DB in DATABASE_URL; restart backend after build"
fi

section "redis (:6379)"
if (exec 3<>/dev/tcp/127.0.0.1/6379) 2>/dev/null; then
  exec 3<&-; exec 3>&-
  ok "redis TCP connect ok"
else
  fail "redis not reachable on 127.0.0.1:6379" "start cnc-redis-1 (docker) or local redis; throttling/sessions will 500 without it"
fi

section "minio + bucket"
# The object-store port depends on how MinIO is run: docker-compose publishes
# 9002:9000, whereas a natively-installed MinIO listens on 9000 directly. Resolve
# the endpoint the same way the backend does (shell env > apps/backend/.env >
# probe) instead of assuming one layout and reporting a false failure.
if [ -z "$S3_ENDPOINT" ] && [ -f "$ROOT/apps/backend/.env" ]; then
  S3_ENDPOINT="$(grep -E '^S3_ENDPOINT=' "$ROOT/apps/backend/.env" | tail -n1 | cut -d= -f2- | tr -d '"'"'"'[:space:]')"
fi
if [ -z "$S3_ENDPOINT" ]; then
  for cand in http://localhost:9000 http://localhost:9002; do
    if [ "$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$cand/minio/health/live")" = "200" ]; then S3_ENDPOINT="$cand"; break; fi
  done
fi
S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
if [ "$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$S3_ENDPOINT/minio/health/live")" = "200" ]; then
  ok "minio live at $S3_ENDPOINT"
else
  fail "minio not live at $S3_ENDPOINT" "start cnc-minio-1 (docker compose up -d minio) or a native 'minio server' on :9000"
fi
# Bucket root: a hardened bucket denies anonymous LIST (403) while still serving
# object GETs for allowlisted extensions. A 200 here means the whole bucket is
# world-listable, which leaks every stored key — warn rather than celebrate it.
BUCKET_CODE="$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$S3_ENDPOINT/$S3_BUCKET/")"
case "$BUCKET_CODE" in
  200) warn "bucket $S3_BUCKET allows anonymous LIST (200)" "harden it: scope anonymous access to object GETs / image extensions only" ;;
  403) ok "bucket $S3_BUCKET reachable, anonymous LIST denied (hardened)" ;;
  *)   fail "bucket $S3_BUCKET HTTP $BUCKET_CODE" "create it: mc alias set local $S3_ENDPOINT minioadmin minioadmin && mc mb local/$S3_BUCKET --ignore-existing" ;;
esac

section "frontend + proxy assumptions"
if [ -f "$ROOT/apps/frontend/src/app/api/proxy/[...path]/route.ts" ]; then
  ok "proxy route present"
else
  fail "proxy route missing" "restore apps/frontend/src/app/api/proxy/[...path]/route.ts"
fi
if grep -q "postcss.config.ts" -r "$ROOT/apps/frontend/package.json" 2>/dev/null; then
  fail "stale postcss reference in package.json" "only postcss.config.mjs must exist"
elif [ -f "$ROOT/apps/frontend/postcss.config.ts" ]; then
  fail "duplicate postcss.config.ts exists" "delete it; keep postcss.config.mjs (tailwind v3)"
else
  ok "single postcss config (mjs)"
fi
# Derive the expected port from the resolved endpoint so this check tracks reality
# (native :9000 vs compose :9002) instead of hardcoding one deployment layout.
S3_PORT="$(printf '%s' "$S3_ENDPOINT" | sed -E 's#^[a-z]+://[^:/]+:([0-9]+).*#\1#')"
if [ -n "$S3_PORT" ] && grep -q "port: '$S3_PORT'" "$ROOT/apps/frontend/next.config.ts" 2>/dev/null; then
  ok "next.config allows MinIO :$S3_PORT in images.remotePatterns"
else
  warn "next.config missing :${S3_PORT:-9000} remotePatterns" "academy/course images may 400 (see next.config.ts images.remotePatterns)"
fi
if curl -s -m 15 -o /dev/null -w "%{http_code}" "$SITE_BASE/academy" | grep -q "200"; then
  ok "frontend serves /academy (200)"
else
  warn "frontend /academy not 200" "start frontend per docs/LOCAL_DEV.md (PATH must include node dir)"
fi

echo ""
echo "doctor: $PASS pass, $WARN warn, $FAIL fail"
[ "$FAIL" -eq 0 ]
