#!/usr/bin/env node
/**
 * Materialise `@titan/shared` as a real directory inside the backend's node_modules.
 *
 * The backend imports `@titan/shared` by package name in ~30 files. pnpm links workspace
 * packages with a symlink, and Vercel's file tracer resolves that link to its real
 * location (`packages/shared/...`) when building the function's file map. A lambda
 * materialises no symlinks, so at runtime Node looks for `node_modules/@titan/shared`
 * while the traced files sit under `packages/shared/`, and the function dies with:
 *
 *   Cannot find module '@titan/shared'
 *   Require stack: - /var/task/database/schema/themes.js - ... - /var/task/main.js
 *
 * Registry packages are fine — `reflect-metadata` resolves because hoisting gives it a
 * real top-level directory. Copying the built output here gives the workspace package
 * that same treatment, so the tracer emits `node_modules/@titan/shared/dist/index.js`
 * and Node can resolve it.
 *
 * Runs as `postbuild`, so it only affects the deployed bundle. Everything here is a
 * build artifact inside node_modules and is gitignored.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const repoRoot = resolve(backendRoot, '../..');

/** existsSync follows symlinks and is false for a broken link; lstat does not. */
const lstatExists = (p) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

const source = join(repoRoot, 'packages/shared');
const sourceDist = join(source, 'dist');

if (!existsSync(sourceDist)) {
  console.error(
    `[shared] packages/shared/dist is missing — was @titan/shared built? Expected it before this script.`,
  );
  process.exit(1);
}

/**
 * Write the copy to the hoisted repo-root node_modules, then delete pnpm's per-package
 * link.
 *
 * Both halves are required, and this was established from the function's filePathMap
 * rather than guessed:
 *
 *  - Vercel emits a registry dep that lives at the repo root as `node_modules/<pkg>/…`,
 *    which is exactly where Node's resolver looks. That is why hoisting fixed
 *    reflect-metadata (0 -> 2584 top-level entries).
 *  - pnpm links a workspace package at `apps/backend/node_modules/@titan/shared`. The
 *    tracer follows that link and emits `apps/backend/node_modules/@titan/shared/…`, which
 *    no Node resolver will ever find from /var/task. While the link exists the tracer
 *    never even traces the root copy.
 *
 * So: materialise at the root, then remove the link so the tracer is forced to resolve
 * `@titan/shared` to the root copy like any other dependency.
 */
const target = join(repoRoot, 'node_modules/@titan/shared');

// Replace rather than merge: a stale copy from a previous build would shadow the new one.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(source, 'package.json'), join(target, 'package.json'));
cpSync(sourceDist, join(target, 'dist'), { recursive: true });

// Sanity check: the package's declared entry must actually exist in the copy, otherwise
// the lambda fails at require time with exactly the error this script exists to prevent.
const pkg = JSON.parse(
  await import('node:fs').then((fs) => fs.readFileSync(join(target, 'package.json'), 'utf8')),
);
const entry = join(target, pkg.main.replace(/^\.\//, ''));
if (!existsSync(entry)) {
  console.error(`[shared] entry point missing after copy: ${entry}`);
  process.exit(1);
}

// Drop the backend's own node_modules so nothing resolves from it.
//
// pnpm's hoisted install puts every package at the repo root, but it ALSO leaves a
// per-package node_modules for some direct dependencies. Vercel's tracer then traces those
// through the nearer path and emits them at 'apps/backend/node_modules/<pkg>/', which no
// Node resolver inside the lambda will ever find. Observed affecting jsonwebtoken,
// socket.io, ioredis, @aws-sdk, @smithy, jws, @ioredis, cluster-key-slot and jwa -- each
// present at the root, and each resolving fine from there.
//
// Deleting it after the build forces both the tracer and runtime Node onto the hoisted
// root: the layout that verifiably emits resolvable top-level paths. The backend has
// already been compiled at this point and its .bin scripts are invoked through the package
// manager, so nothing needs this directory afterwards.
const perPackageModules = join(backendRoot, 'node_modules');
if (lstatExists(perPackageModules)) {
  rmSync(perPackageModules, { recursive: true, force: true });
  console.log('[shared] removed apps/backend/node_modules so resolution uses the hoisted root');
}

console.log(`[shared] materialised @titan/shared (entry ${pkg.main}) -> ${target}`);