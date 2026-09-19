#!/usr/bin/env bash
#
# Live proof that the admin session survives an invalidated access token.
#
# Sequence: log in -> confirm authenticated -> delete ONLY the httpOnly access cookie
# over CDP (leaving refresh + csrf intact, exactly the 15-minute-expiry shape) -> reload
# -> confirm the page is still the authenticated admin view and not a /login bounce.
#
# Requires a browser session driven by the agent-browser CLI. AB points at a wrapper
# that invokes it; override with AB=/path/to/agent-browser if it is on your PATH.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AB="${AB:-/tmp/ab.sh}"
NODE="${NODE_BIN:-}"
if [ -z "$NODE" ]; then
  for cand in "$HOME/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node" "$(command -v node 2>/dev/null || true)"; do
    [ -x "$cand" ] && NODE="$cand" && break
  done
fi
[ -z "$NODE" ] && { echo "hydration-check: FATAL — no Node found. Set NODE_BIN=..." >&2; exit 2; }
OUT="${OUT:-/tmp/visual-check}"
mkdir -p "$OUT"
export NO_PROXY="localhost,127.0.0.1,::1${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"

EMAIL="${VERIFY_EMAIL:-admin@titansofmanufacturing.com}"
PASSWORD="${VERIFY_PASSWORD:-Test1234!}"
TARGET="/admin/staff"

# Single-quoted so bash does not eat the quotes; double quotes inside keep JS valid.
SIG_JS='JSON.stringify({url:location.pathname,authed:!!document.querySelector("nav a[href=\"/admin\"], aside"),h1:((document.querySelector("h1")||{}).textContent||"").trim().slice(0,40),err:/Application error|Unhandled Runtime|CSRF token|Internal Server Error/i.test(document.body.innerText)})'
sig() { "$AB" eval "$SIG_JS" 2>/dev/null | tail -1; }

echo "--- login ---"
# Authenticate against the API and inject the cookies over CDP. Driving the login form
# through the CLI is flaky and can hang; this is deterministic.
"$AB" open "http://localhost:3000/" >/dev/null 2>&1
"$AB" wait --load load >/dev/null 2>&1
"$AB" wait 1500 >/dev/null 2>&1
"$AB" eval "localStorage.setItem('titans-color-mode','light')" >/dev/null 2>&1
CDP="$("$AB" get cdp-url 2>/dev/null | tail -1)"
if ! "$NODE" "$HERE/cdp-login.mjs" "$CDP" "http://localhost:3000" "http://localhost:4000" "$EMAIL" "$PASSWORD"; then
  echo "ABORT: could not establish a session" >&2
  exit 2
fi

echo
echo "--- baseline (valid access token) ---"
"$AB" open "http://localhost:3000$TARGET" >/dev/null 2>&1
"$AB" wait --load load >/dev/null 2>&1
"$AB" wait 2500 >/dev/null 2>&1
BASELINE="$(sig)"
echo "baseline: $BASELINE"
if ! printf '%s' "$BASELINE" | tr -d '\\' | grep -q '"authed":true'; then
  echo "ABORT: login did not establish an authenticated session — fix that before reading anything below."
  exit 2
fi

echo
echo "--- invalidate access token over CDP ---"
CDP="$("$AB" get cdp-url 2>/dev/null | tail -1)"
echo "cdp: ${CDP:0:48}..."
"$NODE" "$HERE/cdp-drop-access.mjs" "$CDP"
CDP_RC=$?

echo
echo "--- reload with a dead access token, valid refresh token ---"
"$AB" reload >/dev/null 2>&1
"$AB" wait --load load >/dev/null 2>&1
"$AB" wait 4000 >/dev/null 2>&1
AFTER="$(sig)"
echo "after:    $AFTER"
"$AB" screenshot "$OUT/staff-after-access-expiry-light.png" >/dev/null 2>&1

echo
echo "--- verdict ---"
CLEAN="$(printf '%s' "$AFTER" | tr -d '\\')"
RC=0
if [ "$CDP_RC" -ne 0 ]; then echo "FAIL  could not invalidate the access token (CDP)"; RC=1; fi
if printf '%s' "$CLEAN" | grep -q "\"url\":\"$TARGET\""; then
  echo "PASS  stayed on $TARGET (no /login bounce)"
else
  echo "FAIL  bounced away from $TARGET"; RC=1
fi
if printf '%s' "$CLEAN" | grep -q '"authed":true'; then
  echo "PASS  still authenticated"
else
  echo "FAIL  lost authentication"; RC=1
fi
if printf '%s' "$CLEAN" | grep -q '"err":false'; then
  echo "PASS  no error surface rendered"
else
  echo "FAIL  error surface rendered"; RC=1
fi
exit $RC
