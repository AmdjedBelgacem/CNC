/**
 * Golden SSR snapshot gate for the builder pages.
 *
 * Renders every builder-managed public route through the dev server, normalizes
 * the HTML (strips scripts/streaming markers/comments/whitespace), and diffs it
 * against the committed goldens in tests/snapshots/. Any difference means the
 * page moved away from its reference layout — the gate must pass after every
 * builder change.
 *
 * Usage:
 *   node scripts/snapshot-builder-pages.mjs            # verify (exit 1 on drift)
 *   node scripts/snapshot-builder-pages.mjs --update   # regenerate goldens
 *
 * Prerequisite: the frontend dev server (pnpm dev) on http://localhost:3000.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SNAPSHOT_BASE ?? 'http://localhost:3000';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'snapshots');
const UPDATE = process.argv.includes('--update');

// slug -> public URL path
const PAGES = {
  home: '/',
  'academy-landing': '/academy',
  about: '/about',
  privacy: '/privacy',
  refunds: '/refunds',
  terms: '/terms',
  'edu-purchases': '/edu-purchases',
};

function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*rel="(?:preload|stylesheet)"[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let failed = false;
for (const [slug, path] of Object.entries(PAGES)) {
  const res = await fetch(BASE + path);
  if (!res.ok) {
    console.error(`[${slug}] ${path} -> HTTP ${res.status} (is the dev server running?)`);
    failed = true;
    continue;
  }
  const actual = normalize(await res.text());
  const file = join(OUT_DIR, `${slug}.html`);
  if (UPDATE) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(file, actual);
    console.log(`[${slug}] golden updated (${actual.length} chars)`);
    continue;
  }
  if (!existsSync(file)) {
    console.error(`[${slug}] no golden at ${file} — run with --update first`);
    failed = true;
    continue;
  }
  const golden = normalize(readFileSync(file, 'utf8'));
  if (actual === golden) {
    console.log(`[${slug}] OK (${actual.length} chars)`);
  } else {
    failed = true;
    console.error(`[${slug}] DRIFT — layout changed since the golden was committed`);
    let i = 0;
    while (i < Math.min(actual.length, golden.length) && actual[i] === golden[i]) i++;
    console.error(`  first diff at char ${i}`);
    console.error(`  golden: ...${golden.slice(Math.max(0, i - 100), i + 200)}`);
    console.error(`  actual: ...${actual.slice(Math.max(0, i - 100), i + 200)}`);
  }
}

if (failed) {
  console.error('\nSnapshot gate FAILED. If the change was intentional, run with --update and commit the new goldens.');
  process.exit(1);
}
console.log(UPDATE ? '\nGoldens regenerated.' : '\nSnapshot gate passed.');