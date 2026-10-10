#!/usr/bin/env bash
# Asserts the Cloudflare-only origin lockdown without locking the operator out.
#
# Covers three ways it has broken:
#   1. container egress blocked -> auth dies with "Authentication is unavailable"
#   2. `-i br-` written instead of `-i br+`, which silently matches nothing
#   3. the inbound block not actually applying
#
# Nothing here restarts anything or edits the firewall. Safe to run any time.
set -uo pipefail

ORIGIN_IP=${ORIGIN_IP:-13.206.178.25}
HOSTNAME=${HOSTNAME_OVERRIDE:-barootcnc.com}
fail=0

ok()   { echo "  PASS  $1"; }
bad()  { echo "  FAIL  $1"; fail=1; }

# --- 1. egress must survive -----------------------------------------------------
# The backend calls Supabase, DeepSeek and Moyasar, all Cloudflare-fronted. If egress to a
# Cloudflare address on :443 is dropped, authentication fails and the AI assistant goes down.
# Any HTTP status is a pass; only a connection failure means the firewall ate it.
# api.supabase.co does not resolve -- each project lives on its own subdomain -- so this
# targets Cloudflare-fronted hosts, which is what the outage actually broke: reaching any
# Cloudflare address on :443.
for host in api.moyasar.com api.deepseek.com; do
  if curl -fsS -o /dev/null --max-time 15 "https://$host/" 2>/dev/null \
     || curl -sS -o /dev/null --max-time 15 "https://$host/" 2>/dev/null; then
    ok "egress reachable: $host"
  else
    bad "egress BLOCKED to $host -- auth will fail"
  fi
done

# --- 2. the interface wildcard must be right ------------------------------------
if iptables -t filter -S DOCKER-USER 2>/dev/null | grep -q -- '-i br+'; then
  ok "container egress exemption uses '-i br+' (matches real bridges)"
else
  bad "no '-i br+' egress exemption; '-i br-' is an exact name and matches nothing"
fi

# --- 3. inbound must be Cloudflare-only and scoped to delivery into containers ----
if iptables -t filter -S DOCKER-USER 2>/dev/null | grep -q -- '-o br+'; then
  ok "web rules scoped with '-o br+' so they only match inbound"
else
  bad "web rules not scoped with '-o br+'; they will also match outbound :443"
fi

cf_rules=$(iptables -t filter -S DOCKER-USER 2>/dev/null | grep -c -- '-j RETURN')
if [ "${cf_rules:-0}" -ge 15 ]; then
  ok "Cloudflare allowances present ($cf_rules RETURN rules)"
else
  bad "only ${cf_rules:-0} RETURN rules; expected at least 15 Cloudflare ranges"
fi

if iptables -t filter -S DOCKER-USER 2>/dev/null | grep -q -- '-j DROP'; then
  ok "default DROP present for non-Cloudflare web traffic"
else
  bad "no DROP rule; the origin is open to the world"
fi

# --- 4. SSH must still be reachable ---------------------------------------------
if ufw status 2>/dev/null | grep -qE '^22/tcp[[:space:]]+ALLOW'; then
  ok "SSH (22) still allowed -- not touched by the lockdown"
else
  bad "SSH rule missing -- do not run this on a host without console access"
fi

echo
[ "$fail" -eq 0 ] && echo "  origin lockdown: all checks passed" || echo "  origin lockdown: FAILURES above"
exit "$fail"
