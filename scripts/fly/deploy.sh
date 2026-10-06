#!/usr/bin/env bash
#
# Deploy the Nest backend to Fly.io.
#
# Assumes the repo-root Dockerfile (unchanged from the Vercel container image) and
# fly.toml. Neither is Fly-specific beyond fly.toml, so the same image serves a
# later Hetzner host — only the URL changes.
#
# Secrets are NOT set by this script. They are read from a local, git-ignored file
# so nothing sensitive reaches the command line, where it would be visible in `ps`
# and in the shell history. That file is:
#
#   .env.fly            (git-ignored; chmod 600)
#
# Format: the same KEY=VALUE lines as .env.example, one secret per line.
#
# Usage:
#   scripts/fly/deploy.sh                 # build + deploy, secrets untouched
#   scripts/fly/deploy.sh --secrets       # also sync secrets from .env.fly
#   scripts/fly/deploy.sh --dry-run       # print the plan and exit
#
set -euo pipefail

APP_NAME="${FLY_APP:-baroot-api}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS_FILE="$ROOT/.env.fly"
DRY_RUN=0
SYNC_SECRETS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --secrets) SYNC_SECRETS=1 ;;
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

command -v fly >/dev/null 2>&1 || {
  cat >&2 <<'EOF'
flyctl is not installed.

  curl -L https://fly.io/install.sh | sh

Then: fly auth login
EOF
  exit 1
}

if [ "$DRY_RUN" -eq 1 ]; then
  say "Dry run — nothing will be changed"
  cat <<EOF
  app             : $APP_NAME
  dockerfile      : $ROOT/Dockerfile (build context = repo root)
  fly.toml        : $ROOT/fly.toml
  secrets file    : $SECRETS_FILE $([ -f "$SECRETS_FILE" ] && echo '(present)' || echo '(MISSING)')

  next commands:
    fly auth login
    fly launch --no-deploy --copy-config --name "$APP_NAME"
    fly secrets set --app "$APP_NAME" --from-file "$SECRETS_FILE"   # if the file exists
    fly deploy --app "$APP_NAME"

  then confirm before switching the frontend:
    curl -fsS https://$APP_NAME.fly.dev/health | head -c 400
    # then set API_URL on Vercel to https://$APP_NAME.fly.dev and deploy
EOF
  exit 0
fi

say "Checking which app this deploys to"
FLY_TARGET="$(fly apps list --json 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try {
      const apps=JSON.parse(s);
      const a=apps.find(x=>x.Name===process.argv[1]);
      process.stdout.write(a ? a.Name : "new");
    } catch { process.stdout.write("new"); }
  });
' "$APP_NAME")"

if [ "$FLY_TARGET" = "new" ]; then
  say "No Fly app named $APP_NAME yet — creating it from fly.toml"
  echo "  (fly launch may ask for an org and a region; accept iad or set your own)"
  fly launch --no-deploy --copy-config --name "$APP_NAME"
else
  say "Fly app '$APP_NAME' found"
fi

if [ "$SYNC_SECRETS" -eq 1 ]; then
  [ -f "$SECRETS_FILE" ] || {
    echo "error: $SECRETS_FILE not found. Create it (chmod 600) or drop --secrets." >&2
    exit 1
  }
  say "Syncing secrets from $SECRETS_FILE (values are not echoed)"
  # --from-file parses KEY=VALUE without putting any value in argv.
  fly secrets set --app "$APP_NAME" --from-file "$SECRETS_FILE"
fi

say "Deploying $APP_NAME"
fly deploy --app "$APP_NAME"

say "Health check — /health must return JSON before you switch the frontend"
cat <<EOF
  curl -fsS https://$APP_NAME.fly.dev/health

  Then, and only then, set API_URL on Vercel:
    https://$APP_NAME.fly.dev
  and deploy the frontend. Deploying Vercel first would point /api/proxy/* at a
  host that does not exist yet and take the whole site down.
EOF