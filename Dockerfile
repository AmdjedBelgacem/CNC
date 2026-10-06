# syntax=docker/dockerfile:1
#
# Backend as a single portable long-running Node server.
#
# Serves three targets with one image: Fly.io (fly.toml), a future Hetzner host
# (docker compose / docker run), and the previous Vercel container service. Only
# the host and the URL change between them — `node apps/backend/dist/main.js` is
# exactly what serves /health locally, so local and production behaviour are
# identical by construction.
#
# Lives at the repository root because the image needs the whole pnpm workspace
# (lockfile, packages/shared and the pnpm patches) to compile the backend.
#
# Why a long-running process rather than a Vercel function: the function launcher
# rejected this module's export shape ("Invalid export found in module
# /var/task/main.js") regardless of entrypoint, and a function cannot hold the
# Socket.IO connections at /ws anyway. Fly.io runs the image directly, so the
# container is kept rather than replaced.

# ── base ──────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

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
# PORT is supplied by the host: Fly injects it, Hetzner/compose can set it, and
# the previous Vercel deployment relied on this default.
ENV PORT=4000
# Bind address. Fly and Docker both need 0.0.0.0; hardcoding it in the image means
# no host has to remember.
ENV HOST=0.0.0.0
WORKDIR /repo

COPY --from=base /repo/node_modules ./node_modules
COPY --from=base /repo/packages ./packages
COPY --from=base /repo/apps/backend/dist ./apps/backend/dist
COPY --from=base /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=base /repo/apps/backend/scripts ./apps/backend/scripts

# The node image already ships an unprivileged `node` user (uid 1000). Running as
# root inside the container is unnecessary and turns any image-level bug into a
# host-level one. Ownership is fixed at copy time so no chown step is needed.
COPY --from=base --chown=node:node /repo/node_modules ./node_modules
COPY --from=base --chown=node:node /repo/packages ./packages
COPY --from=base --chown=node:node /repo/apps/backend/dist ./apps/backend/dist
COPY --from=base --chown=node:node /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=base --chown=node:node /repo/apps/backend/scripts ./apps/backend/scripts

# /repo itself is root-owned, and UPLOAD_DIR defaults to `<cwd>/uploads`. Running as
# `node` therefore fails at boot with EACCES on mkdir — the app dies before it can
# serve /health. Creating the directory here, owned by the runtime user, keeps the
# default path working without granting write access to the code.
RUN mkdir -p /repo/uploads && chown node:node /repo/uploads

USER node

# Informational only: Fly routes to `internal_port` in fly.toml and overrides
# PORT; the EXPOSE value here does not need to match it.
EXPOSE 8080

# Cap V8's old-space so the heap is bounded by something we choose rather than by
# whatever the container happens to be given.
#
# Measured on this app: steady-state RSS is ~178 MB and idle CPU is ~0%, but under a
# request burst Node sized its heap against the full 2 GB cgroup limit and grew toward it
# before collecting. On a container billed by provisioned memory that headroom is pure
# risk, and on a smaller instance it is an OOM kill. 512 MB leaves ~3x headroom over the
# measured working set, so GC runs earlier under load instead of the heap expanding.
#
# At 512 MB of provisioned memory this is ~3x the measured working set, so V8
# collects before the heap expands. On a SMALLER machine the cap must come DOWN,
# not up: V8 sizes its heap against the limit it is given, so an unbounded heap
# on a 256 MB machine means the kernel OOM-kills the process before V8 feels any
# pressure. Override with -e NODE_OPTIONS on Fly at 256 MB; see fly.toml.
ENV NODE_OPTIONS="--max-old-space-size=512"

# Containers are long-running processes, so this is a real server rather than a
# per-invocation handler. `node dist/main.js` is the same command used locally.
CMD ["node", "apps/backend/dist/main.js"]
