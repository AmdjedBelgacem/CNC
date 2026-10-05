# syntax=docker/dockerfile:1
#
# Backend as a Vercel **container** service.
#
# Why a container and not a Node function: the function launcher rejected the module's
# export shape ("Invalid export found in module /var/task/main.js") no matter how the
# entrypoint was authored, and a function cannot hold the Socket.IO connections at /ws
# anyway. A container runs the exact same long-running `node dist/main.js` that serves
# /health locally, so local and production behaviour are identical by construction.

# ── base ──────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────────
# The lockfile, workspace manifests and the pnpm patch are the only inputs that affect
# the dependency tree, so they are copied first to keep this layer cached.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Only packages that actually contain a package.json. config-eslint and config-tailwind
# are config-only directories matched by the `packages/*` workspace glob, so pnpm skips
# them and there is nothing to copy.
COPY packages/config-typescript/package.json packages/config-typescript/
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin/package.json apps/admin/
COPY patches patches

# argon2 is a native addon: it needs a toolchain and python to build, and pnpm needs
# permission to run install scripts. Without this the image silently falls back to scrypt.
RUN --mount=type=cache,target=/pnpm/store \
    apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pnpm install --frozen-lockfile \
 && pnpm config set enable-pre-post-scripts true \
 && pnpm rebuild argon2

# ── build ─────────────────────────────────────────────────────────────────────────
# Copy the sources after installing so the dependency layer stays cached. The build runs
# through turbo so @titan/shared is compiled first (the backend imports it by name).
COPY . .
RUN pnpm turbo build --filter=@titan/backend

# ── runtime ────────────────────────────────────────────────────────────────────────
# argon2's compiled binary is produced for glibc, so the runtime stage must be glibc too.
# Debian-slim keeps that consistent and avoids a musl/mismatch class of failures.
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY --from=base /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=base /app/apps/backend/scripts ./apps/backend/scripts

EXPOSE 4000

# Containers are long-running processes, so this is a real server rather than a
# per-invocation handler. `node dist/main.js` is the same command used locally.
CMD ["node", "apps/backend/dist/main.js"]