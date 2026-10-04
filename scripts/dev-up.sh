#!/usr/bin/env bash
# Bring up the TITANS dev stack (Postgres-backed API on :4000 + Next on :3000)
# in a way that SURVIVES the shell/session that launched it.
#
# Why this exists: starting `node dist/main.js` or `next dev` as a plain background
# job gets killed whenever the launching shell ends, so the stack silently dies and
# every page then shows empty/error states that look like frontend regressions.
# `nohup` + background + `disown` detaches from the launching shell's job table so it
# is not reaped with the parent. (Note: `setsid` does NOT exist on macOS — don't use it.)
#
# Usage:  bash scripts/dev-up.sh [status|stop]
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$HOME/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin"
[ -x "$NODE_BIN/node" ] || NODE_BIN="$(dirname "$(command -v node)")"
export PATH="$NODE_BIN:$PATH"
export HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy=""   # loopback must bypass proxy

BACKEND_DIR="$ROOT/apps/backend"
FRONTEND_DIR="$ROOT/apps/frontend"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

start_backend() {
  if [ -n "$(port_pid 4000)" ]; then echo "backend  : already up"; return; fi
  ( cd "$BACKEND_DIR" && nohup "$NODE_BIN/node" dist/main.js >> "$LOG_DIR/backend.log" 2>&1 & disown ) 
  echo "backend  : starting"
}

start_frontend() {
  if [ -n "$(port_pid 3000)" ]; then echo "frontend : already up"; return; fi
  # Use the workspace's own `next` binary: `npx` inside a detached setsid subshell
  # silently produced no process and an empty log.
  ( cd "$FRONTEND_DIR" && nohup ./node_modules/.bin/next dev -p 3000 >> "$LOG_DIR/frontend.log" 2>&1 & disown )
  echo "frontend : starting"
}

case "${1:-up}" in
  status)
    for p in 3000 4000 5432; do
      pid="$(port_pid "$p")"
      if [ -n "$pid" ]; then echo ":$p up (pid $pid)"; else echo ":$p DOWN"; fi
    done
    ;;
  stop)
    for p in 3000 4000; do
      pid="$(port_pid "$p")"; [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "killed :$p"
    done
    ;;
  up|"")
    start_backend
    start_frontend
    echo "--- waiting for readiness ---"
    for i in $(seq 1 40); do
      b="$(port_pid 4000)"; f="$(port_pid 3000)"
      [ -n "$b" ] && [ -n "$f" ] && break
      sleep 1
    done
    bash "${BASH_SOURCE[0]}" status
    echo
    echo "logs: $LOG_DIR/{backend,frontend}.log"
    echo "tip : curl --noproxy '*' http://127.0.0.1:4000/auth/csrf-token  -> 200 means API ready"
    ;;
esac
