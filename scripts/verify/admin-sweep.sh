#!/usr/bin/env bash
#
# Render every admin route in a real browser and report the resolved theme tokens.
#
# This is the check that catches what unit tests cannot: /admin/courses/new once rendered
# a bare "CSRF token mismatch" page and no test noticed. A route is only healthy if the
# page title is the real heading (not "Sign In", which means the session dropped) and no
# error surface is present.
#
# Usage:  bash scripts/verify/admin-sweep.sh [light|dark]     (default: light)
# Env:    AB   — agent-browser wrapper (default /tmp/ab.sh)
#         OUT  — screenshot directory (default /tmp/visual-check)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AB="${AB:-/tmp/ab.sh}"
MODE="${1:-light}"
OUT="${OUT:-/tmp/visual-check}"
mkdir -p "$OUT"
export NO_PROXY="localhost,127.0.0.1,::1${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"

NODE="${NODE_BIN:-}"
if [ -z "$NODE" ]; then
  for cand in "$HOME/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node" "$(command -v node 2>/dev/null || true)"; do
    [ -x "$cand" ] && NODE="$cand" && break
  done
fi
[ -z "$NODE" ] && { echo "admin-sweep: FATAL — no Node found. Set NODE_BIN=..." >&2; exit 2; }

EMAIL="${VERIFY_EMAIL:-admin@titansofmanufacturing.com}"
PASSWORD="${VERIFY_PASSWORD:-Test1234!}"
BASE="${BASE_URL:-http://localhost:3000}"
API="${API_BASE:-http://localhost:4000}"

ROUTES=(
  "/admin|dashboard"
  "/admin/analytics|analytics"
  "/admin/academies|academies"
  "/admin/academies/new|academies-new"
  "/admin/courses|courses"
  "/admin/courses/new|courses-new"
  "/admin/certificates|certificates"
  "/admin/users|users"
  "/admin/staff|staff"
  "/admin/staff/roles|roles"
  "/admin/settings|settings"
  "/admin/theme|theme"
  "/admin/builder|builder"
)

SIG_JS='JSON.stringify({url:location.pathname,dark:document.documentElement.classList.contains("dark"),bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color,h1:((document.querySelector("h1")||{}).textContent||"").trim().slice(0,40),err:/Application error|Unhandled Runtime|Internal Server Error|CSRF token mismatch/i.test(document.body.innerText)})'

echo "--- login ($MODE) ---"
# Authenticate against the API and inject the cookies over CDP. Driving the login form
# through the CLI is the flakiest step here and can hang indefinitely on a slow paint.
"$AB" open "$BASE/" >/dev/null 2>&1
"$AB" wait --load load >/dev/null 2>&1
"$AB" wait 1500 >/dev/null 2>&1
"$AB" eval "localStorage.setItem('titans-color-mode','$MODE')" >/dev/null 2>&1
CDP="$("$AB" get cdp-url 2>/dev/null | tail -1)"
if ! "$NODE" "$HERE/cdp-login.mjs" "$CDP" "$BASE" "$API" "$EMAIL" "$PASSWORD"; then
  echo "admin-sweep: FATAL — could not establish a session" >&2
  exit 2
fi

FAILED=0
echo
printf '%-26s %s\n' "ROUTE" "SIGNATURE"
for row in "${ROUTES[@]}"; do
  path="${row%%|*}"; name="${row##*|}"
  # `eval` occasionally returns nothing (a slow paint or a dropped CDP session). An empty
  # result used to fall through and be reported as "redirected away from <path>" — which is
  # a lie: a real redirect still returns JSON, just with a different `url`. Retry once, and
  # if it is still empty say so explicitly instead of inventing a redirect.
  for attempt in 1 2; do
    "$AB" open "$BASE$path" >/dev/null 2>&1
    "$AB" wait --load load >/dev/null 2>&1
    "$AB" wait $([ "$attempt" -eq 1 ] && echo 1800 || echo 4000) >/dev/null 2>&1
    SIG="$("$AB" eval "$SIG_JS" 2>/dev/null | tail -1)"
    [ -n "$SIG" ] && break
  done
  "$AB" screenshot "$OUT/${name}-${MODE}.png" >/dev/null 2>&1
  CLEAN="$(printf '%s' "$SIG" | tr -d '\\')"
  printf '%-26s %s\n' "$path" "$SIG"
  if [ -z "$CLEAN" ]; then
    echo "   ^ FAIL no signature — tooling failure (empty eval), NOT a redirect"; FAILED=$((FAILED+1))
    continue
  fi
  if printf '%s' "$CLEAN" | grep -q '"err":true'; then
    echo "   ^ FAIL error surface"; FAILED=$((FAILED+1))
  fi
  if printf '%s' "$CLEAN" | grep -q '"h1":"Sign In"'; then
    echo "   ^ FAIL session dropped (login screen)"; FAILED=$((FAILED+1))
  fi
  # /admin/courses/new is a create-then-edit route: it mints a draft and redirects to
  # that course's editor. Landing on /admin/courses/<id>/edit is success, not a bounce.
  case "$path" in
    "/admin/courses/new")
      printf '%s' "$CLEAN" | grep -qE '"url":"/admin/courses/[^/]+/edit"' \
        || { echo "   ^ FAIL did not reach the Course Studio editor"; FAILED=$((FAILED+1)); } ;;
    *)
      printf '%s' "$CLEAN" | grep -q "\"url\":\"$path\"" \
        || { echo "   ^ FAIL redirected away from $path"; FAILED=$((FAILED+1)); } ;;
  esac
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "admin-sweep ($MODE): all ${#ROUTES[@]} routes OK"
else
  echo "admin-sweep ($MODE): $FAILED problem(s)"
fi
exit $([ "$FAILED" -eq 0 ] && echo 0 || echo 1)
