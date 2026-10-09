import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from '@titan/shared';

/**
 * Guards the one list that has to stay in step with the filesystem.
 *
 * Next.js resolves a real route directory before a dynamic `[slug]`, so a page created at a
 * slug that already has a folder passes validation, publishes without complaint, and then
 * 404s for every visitor. The failure is invisible: no error anywhere, the page simply does
 * not exist.
 *
 * `RESERVED_SLUGS` was 20 folders out of date before this test existed — it reserved
 * `signup` while the folder is `register`, and did not reserve `courses` at all.
 */
const APP_DIR = resolve(__dirname, '../../frontend/src/app');

/**
 * Every URL path the app already serves.
 *
 * Route groups such as `(main)` and `(social)` do not appear in the URL, so they are
 * traversed without contributing a segment — `(main)/(social)/repair` is `/repair`. Only
 * depth-1 paths can collide with `[slug]`, which lives at the app root.
 */
function urlPaths(dir = APP_DIR, segments: string[] = []): string[] {
  const found = existsSync(join(dir, 'page.tsx')) && segments.length ? [segments.join('/')] : [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('@')) continue; // parallel routes, one slot of several
    // A route group contributes nothing to the path but must still be walked through.
    if (name.startsWith('(')) {
      found.push(...urlPaths(join(dir, name), segments));
      continue;
    }
    if (name.startsWith('[')) continue; // dynamic segments handle their own params
    found.push(...urlPaths(join(dir, name), [...segments, name]));
  }
  return [...new Set(found)];
}

describe('RESERVED_SLUGS matches the real route tree', () => {
  const reserved = new Set(RESERVED_SLUGS);

  it('has a readable app directory to check against', () => {
    expect(existsSync(APP_DIR)).toBe(true);
  });

  it('reserves every depth-1 route that would shadow [slug]', () => {
    // `[slug]` sits at the app root, so only single-segment paths can collide with it.
    const topLevel = urlPaths().filter((p) => !p.includes('/'));
    const missing = topLevel.filter((slug) => !reserved.has(slug)).sort();
    expect(missing, `these routes exist but are not reserved, so a page created there would 404: ${missing.join(', ')}`).toEqual([]);
  });

  it('reserves the slugs most likely to be chosen by mistake', () => {
    // Each of these is a real route folder today.
    for (const slug of [
      'courses', 'register', 'tags', 'repair', 'offline',
      'forgot-password', 'reset-password', 'resend-verification',
      'verify-email', 'verify-email-change',
    ]) {
      expect(reserved.has(slug), `${slug} must be reserved`).toBe(true);
    }
  });

  it('keeps future-proofing entries even where no folder exists yet', () => {
    for (const slug of ['admin', 'api', 'cart', 'checkout', 'login', 'search', 'robots.txt']) {
      expect(reserved.has(slug)).toBe(true);
    }
  });

  it('does not reserve dynamic segment names, which are not literal slugs', () => {
    const dynamic: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('[')) dynamic.push(e.name);
        else walk(join(dir, e.name));
      }
    })(APP_DIR);
    expect(dynamic.length).toBeGreaterThan(0); // proves the scan actually finds them
    for (const name of dynamic) expect(reserved.has(name)).toBe(false);
  });

  it('contains no duplicates and no empty entries', () => {
    expect(RESERVED_SLUGS.length).toBe(new Set(RESERVED_SLUGS).size);
    expect(RESERVED_SLUGS.filter((s) => !s || s.trim() !== s)).toEqual([]);
  });
});