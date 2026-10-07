# Recovery: snapshots, restores, and what to check afterwards

There is **no automated backup** on this host today. Docker volumes hold the Caddy TLS
material, and the application's real data lives in Supabase (which has its own PITR).
What a Lightsail snapshot gives you is the *host*: the repo, the env file, the compose
stack and the Caddy certificates, without which a rebuild takes an hour.

## Take a snapshot

- **Before any deploy** that recreates containers, changes the Caddyfile or rotates a
  secret.
- **Weekly**, whether or not anything changed. Set a calendar reminder; nothing on this
  host is scheduled.

Lightsail console → **Instances** → `barootcnc` → **Snapshot** (or
`aws lightsail create-instance-snapshot --instance-name barootcnc --instance-snapshot-name snap-$(date -u +%Y%m%d)`).

A snapshot is a crash-consistent volume image, not an application backup. It is not
backed up to another region. Treat it as "fast rollback", not "disaster recovery".

## Restoring

1. Lightsail → **Create instance** from the snapshot, or **Attach** it to a stopped
   instance.
2. Attach the **same static IP** (`13.206.178.25`) or DNS will point at the wrong box.
   Re-point `barootcnc.com` A records if the IP differs.
3. Restore the instance firewall: TCP 22 from your IP, 80 and 443 from `0.0.0.0/0`
   (or from Cloudflare ranges only if you have completed
   `docs/ops/CLOUDFLARE_IN_TERNT.md` step 6).
4. SSH in, then **verify rather than assume**:

```bash
cd /opt/titanic/cnc/deploy/lightsail
docker compose --project-name titan up -d      # everything has restart: unless-stopped
cd /opt/titanic/cnc && bash scripts/lightsail/smoke.sh
```

`smoke.sh` exits non-zero if any container is down, if a non-Caddy container holds a
host port, if the site or `/api/proxy/health` misbehaves, if `/api/docs` is exposed or
if the edge security headers are missing. Run it after every restore and every deploy.

## What a restore will and will not bring back

| Restored with the snapshot | Not restored (needs the real source) |
| --- | --- |
| `/opt/titanic/cnc` repo + `deploy/lightsail/.env` (mode 600) | Database contents — Supabase, not this host |
| Docker images already built on the host | Anything only on the build machine |
| Caddy certificates (`caddy_data` volume) | Caddy rate-limit state (in-memory, rebuilds empty) |
| fail2ban jail definitions + audit rules | fail2ban ban lists and audit history |

The banned-IP list and audit trail are deliberately ephemeral. That is a real gap: if
you suspect an intrusion, copy `/var/log/audit/audit.log*`, `/var/log/auth.log*` and
`/var/log/fail2ban.log` off the host **before** restoring anything, or the evidence is
lost.

## Backup the things that are not on the host

- **Supabase**: enable point-in-time recovery (Project Settings → Database) and take a
  weekly export. This is the only copy of customer data.
- **Local uploads**: the S3 credentials in `.env` point at Supabase Storage buckets
  `uploads` (public) and `media` (private). They live in the same project, so they
  need the same PITR/export discipline.
- **Secrets**: `.env` is on the snapshot. Keep the rotation checklist current so a
  restored host is never running a secret you have already rotated.

## If SSH is unreachable after a restore

The browser console works independently of port 22 rules:

Lightsail → Instances → `barootcnc` → **Connect** (browser terminal).
