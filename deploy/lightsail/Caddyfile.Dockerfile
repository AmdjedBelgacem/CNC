# Caddy WITH the rate_limit module, for the Lightsail edge.
#
# The official `caddy` image does not ship `rate_limit` (added to Caddy 2.10 but not
# in the default module set), and the deploy/lightsail/docker-compose.yml default
# stays the official image so a fresh clone still boots. Point CADDY_IMAGE at the
# tag built from this file to enable the edge zones in deploy/lightsail/Caddyfile.
#
# BUILD OFF THE PRODUCTION HOST. The 2 GB Lightsail instance must never compile
# anything: a toolchain build there has twice OOM-killed the box.
#
#   docker buildx build --platform linux/amd64 --load \
#     -f deploy/lightsail/Caddyfile.Dockerfile -t baroot/caddy-ratelimit:2.10.2 .
#   docker save baroot/caddy-ratelimit:2.10.2 | gzip | \
#     ssh ubuntu@<host> 'gunzip | docker load'
#   # then on the host: CADDY_IMAGE=baroot/caddy-ratelimit:2.10.2 in deploy/lightsail/.env
FROM caddy:2.10.2-builder AS builder
RUN xcaddy build v2.10.2 \
      --with github.com/mholt/caddy-ratelimit

FROM caddy:2.10.2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
