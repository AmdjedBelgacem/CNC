/**
 * Mirror horizontal "next/previous" icons in RTL.
 *
 * A chevron pointing right means "forward" in a left-to-right page and "back"
 * in a right-to-left one, so it has to mirror. A chevron pointing down, or a
 * trend arrow in a chart, encodes a value or an axis instead of a reading
 * direction and must be left alone — the analytics dashboard is full of those.
 *
 *   node scripts/rtl-icons.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/frontend/src');
const write = process.argv.includes('--write');

/** Horizontal, direction-of-reading icons. */
const HORIZONTAL = [
  'CircleChevronLeft', 'CircleChevronRight',
  'ChevronLeft', 'ChevronRight',
  'ArrowLeft', 'ArrowRight',
];

/** Files where a left/right icon encodes data, not navigation. */
const DO_NOT_FLIP = [
  'components/admin/analytics-dashboard.tsx',
  'components/analytics/',
];

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.turbo'].includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
};

let files = 0;
let icons = 0;

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (DO_NOT_FLIP.some((d) => rel.includes(d))) continue;
  const original = readFileSync(file, 'utf8');
  let out = original;

  for (const icon of HORIZONTAL) {
    const re = new RegExp(`<${icon}(\\s[^>]*?)?/>`, 'g');
    out = out.replace(re, (match, attrs = '') => {
      if (!attrs) return `<${icon} className="flip-rtl" />`;
      if (/flip-rtl|rtl:/.test(attrs)) return match;
      icons += 1;
      if (/className="/.test(attrs)) {
        return `<${icon}${attrs.replace('className="', 'className="flip-rtl ')}/>`;
      }
      return `<${icon}${attrs} className="flip-rtl"/>`;
    });
  }

  if (out !== original) {
    files += 1;
    if (write) writeFileSync(file, out);
  }
}

console.log(`=== RTL icon mirroring (${write ? 'applied' : 'report only'}) ===`);
console.log(`  icons to mirror: ${icons} across ${files} files`);
