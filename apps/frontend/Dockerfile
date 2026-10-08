# Frontend (Next.js) — long-running container, multi-stage, non-root.
#
# Lives at apps/frontend/ but builds with the repo root as context (compose sets it),
# because a pnpm monorepo needs pnpm-lock.yaml, packages/*, and patches/.
#
# The same image is intended to serve any plain Docker host: Lightsail, Hetzner,
# or a local compose. It is Deliberately NOT deployed to Vercel — Next on Vercel
# needs no image, and paying for one there is exactly the consumption being moved
# off a serverless runtime.

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Dummy manifests: only package.json of each workspace package is needed for the
# lockfile to resolve, which keeps the heavy install layer cached on source changes.
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY patches patches
RUN --mount=type=cache,target=/pnpm/store \
    apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must be
# present during `next build`, not just at runtime. Pass with --build-arg.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DEFAULT_TENANT_SLUG
ARG NEXT_PUBLIC_REALTIME_MODE
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_SNAPCHAT_PIXEL_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_DEFAULT_TENANT_SLUG=$NEXT_PUBLIC_DEFAULT_TENANT_SLUG \
    NEXT_PUBLIC_REALTIME_MODE=$NEXT_PUBLIC_REALTIME_MODE \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=$NEXT_PUBLIC_SNAPCHAT_PIXEL_ID
# `next build` sizes its heap against this limit. Unbounded it grew past the
# 2 GB the Lightsail box actually has, and the kernel OOM-killer took the whole
# host down mid-build — every container came back only because of a reboot.
ENV NODE_OPTIONS="--max-old-space-size=1400"
RUN pnpm turbo build --filter=@titan/frontend

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /repo
RUN corepack enable
# Reuse the deps node_modules — Next start needs it — but own the tree by the
# node user so no COPY runs as root and nothing needs a chown pass afterwards.
COPY --from=deps --chown=node:node /repo/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /repo/apps/frontend ./apps/frontend
COPY --from=build --chown=node:node /repo/packages ./packages
RUN mkdir -p .next/cache && chown node:node /repo/apps/frontend/.next/cache
# Bind the service worker's cache names to this build's ID.
#
# It caches HTML, and Next content-hashes every script under /_next/static, so cached HTML
# is only loadable by the build that produced it. A fixed version string left sw.js
# byte-identical across deploys: the worker never re-activated, never cleared its caches, and
# served one deploy's HTML against the next deploy's (absent) chunks. Whenever that fallback
# was reached, hydration failed and the page went blank. Substituting the build ID means the
# file changes whenever the app does, so `activate` fires and the old caches are deleted.
RUN BUILD_ID="$(cat /repo/apps/frontend/.next/BUILD_ID)" \
 && test -n "$BUILD_ID" \
 && sed -i "s/__BUILD_ID__/$BUILD_ID/g" /repo/apps/frontend/public/sw.js \
 && grep -q "$BUILD_ID" /repo/apps/frontend/public/sw.js \
 && echo "service worker scoped to build $BUILD_ID"
USER node

# Same Node version as the Vercel client build and the backend image, so the
# behaviour (trust proxy, cookie flags, WS upgrade headers) matches everywhere.
ENV PORT=3000
ENV HOST=0.0.0.0
# 384 MB is about the same headroom under a 512 MB machine: V8 sizes its heap
# against the limit it is given, so the heap will not expand into OOM first.
ENV NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 3000
CMD ["pnpm", "--dir", "apps/frontend", "start"]