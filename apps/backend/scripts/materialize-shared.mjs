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
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const repoRoot = resolve(backendRoot, '../..');

const source = join(repoRoot, 'packages/shared');
const sourceDist = join(source, 'dist');

if (!existsSync(sourceDist)) {
  console.error(
    `[shared] packages/shared/dist is missing — was @titan/shared built? Expected it before this script.`,
  );
  process.exit(1);
}

/**
 * Write the copy to BOTH plausible locations.
 *
 * Vercel emits traced file paths asymmetrically, which was observed directly in the
 * function's filePathMap:
 *   - service-root files        -> `database/schema/themes.js`      (prefix stripped)
 *   - hoisted root deps         -> `node_modules/reflect-metadata/…` (outside the root)
 *   - the workspace link        -> `apps/backend/node_modules/@titan/shared/…` (kept)
 * Only the first two land where Node's resolver looks. Writing both means one of them is
 * on the correct path regardless of which rule Vercel applies, instead of guessing.
 */
const targets = [join(backendRoot, 'node_modules/@titan/shared'), join(repoRoot, 'node_modules/@titan/shared')];
const target = targets[0];

for (const dir of targets) {
  // Replace rather than merge: a stale copy from a previous build would shadow the new one.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(source, 'package.json'), join(dir, 'package.json'));
  cpSync(sourceDist, join(dir, 'dist'), { recursive: true });
}

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

console.log(`[shared] materialised @titan/shared (entry ${pkg.main}) ->\n  ${targets.join('\n  ')}`);