# Origin lockdown: HTTP/HTTPS restricted to Cloudflare

The origin only accepts web traffic from Cloudflare's published ranges. Anyone hitting
`13.206.178.25` directly on 80/443 is dropped; the site is reachable only through the
proxied hostname `barootcnc.com`.

## Layout

| Piece | Where | Why |
|---|---|---|
| Enforcement | `DOCKER-USER` in `iptables` + `ip6tables` | Caddy publishes `0.0.0.0:443->443/tcp`. Published container ports are DNAT'd and traverse `FORWARD`, which UFW does not filter — so UFW rules alone would have no effect. |
| Declaration | UFW rules, `# Cloudflare only` | Records intent where an operator looks, and protects anything not published via Docker. |
| Refresh | `/usr/local/sbin/update-cloudflare-ufw.sh` | Downloads the current lists and applies them. |
| Boot/reapply | `cloudflare-ufw.service` | `After=docker.service`, `Requires=docker.service`, so it re-runs when Docker restarts. |

The host has a global IPv6 address, so `ip6tables` needs the same rules as `iptables`.

## Operations

    sudo /usr/local/sbin/update-cloudflare-ufw.sh            # apply now
    sudo /usr/local/sbin/update-cloudflare-ufw.sh --check    # print ranges, change nothing

Both are idempotent — re-running replaces the marked rules instead of stacking them.

**There is no cron timer installed.** Refresh deliberately runs at boot and on Docker restart,
not on a schedule: a silent timer that silently fails to fetch would otherwise be able to leave
the rules stale, and an unattended edit to a firewall is not worth the convenience. If you want a
weekly refresh, add a systemd timer deliberately and monitor it:

    # /etc/systemd/system/cloudflare-ufw.timer  — NOT installed by default
    # [Timer]
    # OnCalendar=weekly
    # Persistent=true

The script refuses to run if either range file comes back empty or non-CIDR, so a failed fetch
cannot lock the origin out or leave it open.

## Verifying

    sudo ufw status numbered
    sudo iptables -t filter -L DOCKER-USER -n -v --line-numbers
    systemctl is-enabled cloudflare-ufw.service

From a home network (not Cloudflare), the origin must be unreachable:

    curl -sI --resolve barootcnc.com:443:13.206.178.25 https://barootcnc.com/   # expect no response
    curl -sI https://barootcnc.com/                                            # expect 200 + cf-ray

## Rollback

    sudo iptables -t filter -F DOCKER-USER
    sudo ip6tables -t filter -F DOCKER-USER
    sudo ufw allow 80,443 proto tcp

SSH is never modified by any of this; port 22 stays allowed from anywhere.
