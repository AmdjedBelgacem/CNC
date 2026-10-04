/**
 * Hardcoded user-facing string scan.
 *
 * A catalog diff cannot tell you a button says "Save" in English inside JSX.
 * This walks JSX text nodes, a few label-bearing attributes, and literal strings
 * passed to toast()/title=/aria-label=, and reports the ones that are not
 * routed through a catalog. The goal is a work list, not a false-positive-free
 * parser: review the output, then fix what a user would actually see.
 *
 *   node scripts/i18n-hardcoded.mjs [--json]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/frontend/src');
const asJson = process.argv.includes('--json');

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.turbo'].includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
};

// Text a user can read: at least one letter, spaces allowed, not a class list,
// not a URL, not a Tailwind/utility token, not a translation call.
const isProse = (value) => {
  const text = value.trim();
  if (text.length < 2) return false;
  if (!/[A-Za-z؀-ۿ]/.test(text)) return false;
  if (/^(https?:|mailto:|#|\/)/.test(text)) return false;
  if (/[{}]/.test(text)) return false;
  // utility-looking: hyphens/dots/slashes with no spaces, or all lowercase ids
  if (!text.includes(' ') && /^[\w\-./:[\]%()#]+$/.test(text)) return false;
  if (/\b(flex|grid|text-|bg-|border|rounded|px-|py-|mt-|mb-|ml-|mr-|gap-|w-|h-|font-|items-|justify-|hover:|focus:|sm:|md:|lg:|xl:|dark:)\b/.test(text)) return false;
  if (text.endsWith('.tsx') || text.endsWith('.ts')) return false;
  return true;
};

const findings = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const lines = source.split('\n');
  const usesCatalog = /useTranslations|getTranslations|\bt\(|t\.rich/.test(source);

  lines.forEach((line, i) => {
    const code = line.split('//')[0];
    if (code.includes('{/*')) return;

    // 1. JSX text: >Some words<
    for (const m of code.matchAll(/>\s*([A-Za-z][^<>{}\n]{1,60}?)\s*</g)) {
      if (isProse(m[1])) {
        findings.push({ file: rel, line: i + 1, kind: 'jsx-text', text: m[1].trim() });
      }
    }
    // 2. Visible attributes
    for (const m of code.matchAll(/\b(placeholder|aria-label|title|alt|label|emptyMessage|emptyText)=["']([^"']{2,70})["']/g)) {
      if (isProse(m[2])) {
        findings.push({ file: rel, line: i + 1, kind: `attr:${m[1]}`, text: m[2].trim() });
      }
    }
    // 3. toasts / confirm dialogs
    for (const m of code.matchAll(/\b(?:toast|alert|confirm)\(\s*\{[^}]*?(?:title|message|description|label):\s*['"]([^'"]{2,70})['"]/g)) {
      findings.push({ file: rel, line: i + 1, kind: 'toast', text: m[1].trim() });
    }
    // 4. Object label maps that a component renders directly
    for (const m of code.matchAll(/^\s*(?:label|title|name|text):\s*['"]([A-Za-z][^'"]{1,40})['"],?\s*$/gm)) {
      if (isProse(m[1])) {
        findings.push({ file: rel, line: i + 1, kind: 'label-map', text: m[1].trim() });
      }
    }
  });

  // Files that render literal English but never import a catalog at all.
  if (!usesCatalog) {
    const literals = findings.filter((f) => f.file === rel);
    if (literals.length > 0) {
      for (const l of literals) l.noCatalogInFile = true;
    }
  }
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  console.log(`=== hardcoded user-facing strings: ${findings.length} in ${byFile.size} files ===\n`);
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of sorted) {
    console.log(`${file}  (${items.length})${items[0]?.noCatalogInFile ? '  [no catalog imported]' : ''}`);
    for (const item of items) console.log(`   ${String(item.line).padStart(5)}  ${item.kind.padEnd(14)} ${JSON.stringify(item.text)}`);
  }
}

writeFileSync(join(ROOT, 'scripts/.i18n-hardcoded-cache.json'), JSON.stringify(findings, null, 2));
