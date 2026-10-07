# Putting Cloudflare in front of barootcnc.com (operator runbook)

Cloudflare is the single biggest available win here: it moves volumetric floods off a
2 GB box entirely, and gives managed WAF rules, bot management and per-route rate
limiting we cannot implement in the stock Caddy image.

**It is not applied.** DNS and the origin firewall are yours to change, and the two
steps can brick the site if done in the wrong order. Follow the order exactly.

## Why the order matters

If you restrict the origin firewall to Cloudflare's ranges *before* the proxied
records are serving traffic, the origin stops answering the world and the site goes
down — and if you break DNS while the firewall is still open, you are merely exposed
rather than offline. So: proxy first, verify, lock down second.

## Step 1 — add the domain (do this first)

1. Cloudflare → **Add a site** → `barootcnc.com` → Free plan.
2. Cloudflare replaces your nameservers with two of its own. At your DNS registrar
   (wherever `barootcnc.com` is delegated), set those nameservers.
   - This changes where DNS is resolved, not the origin itself. Expect a propagation
     window of minutes to a few hours.
3. Confirm the origin keeps serving during propagation:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://barootcnc.com/     # should stay 200
```

## Step 2 — DNS records, proxied

In Cloudflare → DNS → Records:

| Type | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `@` | `13.206.178.25` | **Proxied** (orange cloud) |
| A | `www` | `13.206.178.25` | **Proxied** (orange cloud) |

Do **not** leave any record as "DNS only" pointing at the origin IP — that is a
bypass path straight around Cloudflare.

## Step 3 — TLS

Cloudflare → **SSL/TLS** → **Overview**:

- Set **Full (strict)**. This is only correct once the origin has a valid
  certificate, which it does (Let's Encrypt, verified in the smoke output).
- **Edge Certificates → Always Use HTTPS**: on.
- Do not enable "Flexible". It downgrades origin leg to plaintext and will break the
  `__Host-` secure cookies, so sign-in silently fails.

Origin certificate pinning is optional. With a Cloudflare CA origin cert you may set
SSL mode to Full (strict) and disable public Let's Encrypt on the origin; keeping
Let's Encrypt costs nothing and preserves a working origin if Cloudflare is removed.

## Step 4 — verify before locking the origin

```bash
curl -sS -o /dev/null -w 'apex %{http_code}\n' https://barootcnc.com/
curl -sS -o /dev/null -w 'www  %{http_code}\n' https://www.barootcnc.com/
curl -sSI https://barootcnc.com/ | grep -iE 'server:|cf-ray'
```
- `cf-ray` present ⇒ the request really is going through Cloudflare.
- Sign in through the browser once. This is the real test: OAuth, the `__Host-` cookies
  and the callback all have to survive the extra hop.

## Step 5 — WAF and rate limiting (Cloudflare side)

Cloudflare → **Security → WAF → Managed rules**: enable the default managed rule set
and Cloudflare Managed Ruleset.

Suggested rate-limiting rules (Cloudflare → Security → WAF → Rate limiting rules):

| Path | Requests/minute | Period | Action |
| --- | --- | --- | --- |
| `/api/proxy/auth/login` | 10 | 1 min | Block for 1h |
| `/api/proxy/auth/register` | 5 | 1 min | Block for 1h |
| `/api/proxy/auth/forgot-password` | 5 | 1 min | Block for 1h |
| `/api/proxy/auth/reset-password` | 5 | 1 min | Block for 1h |
| `/auth/oauth/*` | 30 | 1 min | Block for 10 min |

Mirror, not replace, the Caddy zones in `deploy/lightsail/Caddyfile`. The Caddy limits
still matter: Cloudflare only protects traffic it proxies, and if anyone ever points a
DNS-only record at the origin again, the edge is the only thing standing between that
host and the internet.

Country blocking is an operator decision and is deliberately NOT configured here — it
is easy to block a legitimate customer's country by accident.

## Step 6 — lock the origin to Cloudflare (only after step 4 passes)

Once the proxied site is serving correctly and you have accepted that the origin is
Cloudflare-only:

1. Cloudflare publishes its IP ranges at
   <https://www.cloudflare.com/ips/> (IPv4 and IPv6 lists, four CIDRs each).
2. In the **Lightsail console → Networking → Firewall**, set HTTP 80 and HTTPS 443
   source to those ranges, and **remove** the `0.0.0.0/0` rules.
3. Add the same ranges to the host firewall, keeping SSH on your own IP:

```bash
# fetch and apply Cloudflare ranges, keeping the SSH rule exactly as it is
CF4=$(curl -sS https://www.cloudflare.com/ips-v4 | grep -v '^#')
CF6=$(curl -sS https://www.cloudflare.com/ips-v6 | grep -v '^#')
sudo ufw --force delete allow 80/tcp 2>/dev/null; sudo ufw --force delete allow 443/tcp 2>/dev/null
for cidr in $CF4 $CF6; do sudo ufw allow "$cidr" to any port 80 proto tcp comment 'Cloudflare HTTP'; done
for cidr in $CF4 $CF6; do sudo ufw allow "$cidr" to any port 443 proto tcp comment 'Cloudflare HTTPS'; done
sudo ufw status verbose
```

**Do not apply this until step 4 has passed.** If you are not certain, leave 80/443
open — an exposed origin is recoverable, an unreachable one is a page-turner outage.

## Step 7 — real client IPs for logs and rate limits (order-sensitive)

Cloudflare is now the TCP peer, so Caddy and fail2ban will see **Cloudflare's** IPs,
not the visitor's. That quietly breaks three things: the per-IP rate-limit key in
`Caddyfile`, the `caddy-auth-abuse` fail2ban jail, and every audit trail in the access
log.

Fix, in this order:

1. Add Cloudflare's ranges as `trusted_proxies` in the Caddyfile's global options block
   **first** — before changing any key.
2. Only then switch the rate-limit key to the forwarded header:

```
trusted_proxies static 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22
                   141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20
                   197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13
                   104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
```

3. Then point the keys at `{http.request.header.CF-Connecting-IP}`.

**Never swap the header in before `trusted_proxies` is set.** Without the allowlist,
that header is attacker-controlled: anyone could send a random `CF-Connecting-IP` and
get themselves a fresh rate-limit bucket on every request, and poison the logs. The
allowlist is what makes the header trustworthy.

Caddy also needs to log the real client. The access log already records
`client_ip`, which follows the trusted-proxy configuration.

## Step 8 — re-verify

```bash
bash scripts/lightsail/smoke.sh
sudo fail2ban-client status caddy-auth-abuse | grep -E 'Total failed|Currently banned'
```
Expect the jail to start matching again (it currently sees Cloudflare ranges as
"clients", so it may go quiet — that is expected until step 7 is done).
