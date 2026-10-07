#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 / 22.04 host for the TITANS single-origin stack.
#
# Safe to re-run: each step checks whether the thing already exists before creating
# it. Redacts values and needs no secrets.
#
# Usage: sudo bash scripts/lightsail/bootstrap.sh
set -euo pipefail

log() { printf '\n\033[1m> %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ── 1. Docker Engine ──────────────────────────────────────────────────────────
log "Installing Docker Engine"
if ! have docker; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  usermod -aG docker ubuntu || true
else
  echo "  docker $(docker --version) already installed"
fi

# ── 2. Swapfile ───────────────────────────────────────────────────────────────
log "Ensuring a 2 GiB swap file (builds fail OOM without it on a ~1.9 GiB host)"
if ! swapon --show | grep -q /swapfile; then
  if [ ! -f /swapfile ]; then
    if have fallocate; then
      fallocate -l 2G /swapfile
    else
      dd if=/dev/zero of=/swapfile bs=1M count=2048
    fi
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 >/dev/null
echo "  $(swapon --show 2>/dev/null | grep -v Filename | head -1)"

# ── 3. UFW ────────────────────────────────────────────────────────────────────
log "Configuring UFW"
have ufw || apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'Caddy HTTP' >/dev/null
ufw allow 443/tcp comment 'Caddy HTTPS' >/dev/null
ufw --force enable >/dev/null
echo "  UFW active; allow only 22/80/443 inbound:"
ufw status verbose | sed 's/^/    /'

# ── 4. fail2ban ───────────────────────────────────────────────────────────────
log "Installing fail2ban"
have fail2ban-client || apt-get install -y fail2ban
if [ ! -f /etc/fail2ban/jail.local ]; then
  cat >/etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
port = 22
maxretry = 5
findtime = 10m
bantime = 1h
EOF
  echo "  wrote jail.local for sshd"
fi
systemctl enable --now fail2ban

# ── 5. unattended-upgrades ────────────────────────────────────────────────────
log "Enabling unattended security upgrades"
apt-get install -y unattended-upgrades >/dev/null
dpkg-reconfigure -f noninteractive -plow unattended-upgrades || true

# ── 6. App dir + docker log rotation ─────────────────────────────────────────
log "Preparing dirs and docker defaults"
APP_DIR=/opt/titanic
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  chown ubuntu:ubuntu "$APP_DIR"
  echo "  created $APP_DIR (owned by ubuntu)"
fi
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" }
}
EOF
  systemctl restart docker || true
  echo "  wrote /etc/docker/daemon.json"
fi

log "Bootstrap done."
cat <<'EOF'
Next:
  1. rsync the repo to the host, e.g.
       rsync -av --exclude node_modules --exclude .next \\
         ./ ubuntu@$(hostname):/opt/titanic/cnc
  2. cd /opt/titanic/cnc/deploy/lightsail
  3. cp .env.example .env && chmod 600 .env
  4. Fill .env, then from the repo root:
       docker compose -f deploy/lightsail/docker-compose.yml up -d --build
  5. docs/ops/DEPLOY_LIGHTSAIL.md has the DNS step.
EOF