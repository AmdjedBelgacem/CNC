/**
 * Physical → logical direction utility codemod.
 *
 * Tailwind's `ml-*`, `pl-*`, `left-*` and `text-left` encode a side of the
 * screen, so they keep pointing at the same side when the document flips to
 * Arabic and the layout breaks. The logical equivalents (`ms-*`, `ps-*`,
 * `start-*`, `text-start`) follow the writing direction, which is what almost
 * every one of these was meant.
 *
 * Some things ARE genuinely physical: a video scrubber, a chart axis, a
 * code block, a timeline. Those are listed in DIRECTIONAL_ALLOWLIST and are
 * reported, never rewritten.
 *
 *   node scripts/rtl-codemod.mjs           # report only
 *   node scripts/rtl-codemod.mjs --write   # apply
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/frontend/src');
const write = process.argv.includes('--write');

/**
 * Where a left/right offset means "the physical side", not "the reading start".
 * The video player and the analytics charts are the real cases.
 */
const DIRECTIONAL_ALLOWLIST = [
  'components/media/cinematic-player.tsx',
  'components/admin/analytics-dashboard.tsx',
  'components/ai/chat-workspace/ai-chat-workspace.tsx', // the code block inside it
];

/** class → its logical equivalent. Order matters: longer keys first. */
const MAP = [
  [/\bml-/, 'ms-'],
  [/\bmr-/, 'me-'],
  [/\bpl-/, 'ps-'],
  [/\bpr-/, 'pe-'],
  [/\bleft-/, 'start-'],
  [/\bright-/, 'end-'],
  [/\btext-left\b/, 'text-start'],
  [/\btext-right\b/, 'text-end'],
  [/\brounded-l-/, 'rounded-s-'],
  [/\brounded-r-/, 'rounded-e-'],
  [/\bborder-l-/, 'border-s-'],
  [/\bborder-r-/, 'border-e-'],
];

// Values that are already logical, or that must not be touched.
const SAFE_VALUE = /^(-?[\d.]+(px|rem|em|%)?|auto|full|fit)$/;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.turbo'].includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(entry)) out.push(full);
  }
  return out;
};

let changedFiles = 0;
let changedClasses = 0;
const skipped = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (DIRECTIONAL_ALLOWLIST.some((a) => rel.endsWith(a))) {
    const hits = readFileSync(file, 'utf8').match(/\b(?:ml|mr|pl|pr|left|right|text-left|text-right)-[\w.\[\]/%-]+/g);
    if (hits) skipped.push({ file: rel, count: hits.length });
    continue;
  }
  const original = readFileSync(file, 'utf8');
  let out = original;
  for (const [pattern, replacement] of MAP) {
    out = out.replace(new RegExp(`${pattern.source}[\\w.\\[\\]/%-]+`, 'g'), (match) => {
      // `pattern.source` includes the \\b anchor, which is not part of the matched
      // text, so the prefix length has to come from the replacement side.
      const visible = pattern.source.replace(/^\\b/, '');
      const value = match.slice(visible.length);
      // `-left-1/2` and `-right-[3px]` are handled by the map; only rewrite when
      // the value is a plain size/keyword.
      if (!SAFE_VALUE.test(value) && !value.startsWith('[')) return match;
      changedClasses += 1;
      return `${replacement}${value}`;
    });
  }
  if (out !== original) {
    changedFiles += 1;
    if (write) writeFileSync(file, out);
  }
}

console.log(`=== RTL codemod (${write ? 'applied' : 'report only'}) ===`);
console.log(`  files changed: ${changedFiles}`);
console.log(`  classes rewritten: ${changedClasses}`);

if (write && changedClasses > 0) {
  // A mass className rewrite against a running dev server leaves the browser
  // holding client chunks compiled from the previous source. The server then
  // renders `ms-2` while hydration still expects `ml-2`, and React reports a
  // hydration mismatch for every rewritten element. It is not patched up: the
  // old chunk has to go.
  console.log('');
  console.log('  A dev server that was already running is now serving stale client');
  console.log('  chunks and will produce hydration mismatches until it is restarted:');
  console.log('');
  console.log('    pkill -f "next dev"');
  console.log('    rm -rf apps/frontend/.next');
  console.log('    cd apps/frontend && npm run dev:clean   # or: npm run dev');
  console.log('');
  console.log('  A hard reload afterwards is required; the old chunks are in the');
  console.log('  browser cache as well as on disk.');
}
if (skipped.length) {
  console.log('  deliberately left physical (directional UI):');
  for (const s of skipped) console.log(`    ${s.file} — ${s.count} occurrences`);
}
