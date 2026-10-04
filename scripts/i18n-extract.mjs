#!/usr/bin/env node
/**
 * Fill missing catalog keys with the English default declared at the call site.
 *
 * The audit (scripts/i18n-audit.mjs) is authoritative about *which* keys are
 * missing, because it already understands every namespace. This script only
 * answers the remaining question: what English text should the key hold?
 *
 * Every call site in this codebase is written as
 *   t('leaf.key', { default: 'English fallback' })
 * so the English text lives next to the usage. For each key the audit reports as
 * missing, the leaf path is matched against call sites inside files that bind
 * the right namespace, and the declared default is written into the catalog.
 *
 * Usage:
 *   node scripts/i18n-extract.mjs                 # preview
 *   node scripts/i18n-extract.mjs --write         # write into en.json
 *   node scripts/i18n-extract.mjs --write --locale ar.json
 */
import { readFileSync, writeFileSync, globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const write = args.includes('--write');
const li = args.indexOf('--locale');
const locale = li >= 0 ? args[li + 1] : 'en.json';
const catalogPath = `apps/frontend/messages/${locale}`;

/* ---- 1. Ask the audit which keys are missing ------------------------- */
let missing = [];
try {
  const out = execFileSync('node', ['scripts/i18n-audit.mjs'], { encoding: 'utf8' });
  const section = out.split('--- missing from')[1] ?? '';
  for (const line of section.split('\n')) {
    const m = line.match(/^\s{2}([a-zA-Z0-9_.]+)\s*$/);
    if (m) missing.push(m[1]);
    if (line.startsWith('--- in ar.json but never')) break;
  }
} catch {
  console.error('could not run the i18n audit');
  process.exit(1);
}

if (missing.length === 0) {
  console.log('audit reports no missing keys');
  process.exit(0);
}

/* ---- 2. Index every call site that declares an English default --------- */
const files = globSync('apps/frontend/src/**/*.{ts,tsx}', { exclude: ['**/node_modules/**'] });

// Match the key and then scan forward for the `default:` that follows. Trying to
// consume the whole options object with a single regex breaks as soon as a
// default string itself contains a placeholder like '{status}'.
const CALL = /\bt(?:Admin|Common)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g;
const WINDOW = 420;
const DEFAULT = /\bdefault:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/;
const NS = /useTranslations(?:<[^>]*>)?\(\s*(['"`])([a-zA-Z0-9_.]+)\1\s*\)/g;
const VAR_NS = /(?:const|let)\s+(\w+)\s*=\s*useTranslations(?:<[^>]*>)?\(\s*(['"`])([a-zA-Z0-9_.]+)\2\s*\)/g;

const unescape = (s) =>
  s.replace(/\\'/g, "'").replace(/\\`/g, '`').replace(/\\n/g, '\n').replace(/\\"/g, '"');

/** key -> english */
const index = new Map();

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const namespaces = [...src.matchAll(NS)].map((m) => m[2]);
  // Map each local translator variable to the namespace it was bound to.
  const varMap = new Map();
  for (const m of src.matchAll(VAR_NS)) varMap.set(m[1], m[3]);
  const unique = [...new Set(namespaces)];

  for (const m of src.matchAll(CALL)) {
    const raw = m[2];
    if (/\$\{/.test(raw)) continue; // runtime-composed key
    const after = src.slice(m.index, m.index + WINDOW);
    // Stop at the closing paren of this call so a later default is not picked up.
    const head = after.slice(0, after.indexOf('\n') === -1 ? after.length : after.indexOf('\n'));
    const d = DEFAULT.exec(head) ?? DEFAULT.exec(after.slice(0, 160));
    if (!d) continue;
    const value = unescape(d[2]);

    const candidates = new Set();
    if (unique.length === 1) {
      candidates.add(raw.includes('.') ? `${unique[0]}.${raw}` : `${unique[0]}.${raw}`);
    }
    for (const ns of unique) {
      if (raw.startsWith(`${ns}.`)) candidates.add(raw);
      else candidates.add(`${ns}.${raw}`);
    }
    for (const c of candidates) {
      if (!index.has(c)) index.set(c, value);
    }
  }
}

/* ---- 3. Resolve and report ------------------------------------------- */
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const lookup = (key) =>
  key.split('.').reduce((n, p) => (n == null ? undefined : n[p]), catalog);

const resolved = [];
const unresolved = [];
for (const key of missing) {
  const value = index.get(key);
  if (value === undefined) unresolved.push(key);
  else resolved.push([key, value]);
}

if (!write) {
  console.log(`audit: ${missing.length} missing keys`);
  console.log(`resolved from call-site defaults: ${resolved.length}`);
  console.log(`unresolved (need a human): ${unresolved.length}`);
  for (const k of unresolved) console.log(`  ? ${k}`);
  for (const [k, v] of resolved.slice(0, 10)) console.log(`  + ${k} = ${JSON.stringify(v)}`);
  process.exit(0);
}

for (const [key, value] of resolved) {
  const parts = key.split('.');
  let node = catalog;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `wrote ${resolved.length} keys into ${catalogPath}` +
    (unresolved.length ? ` · ${unresolved.length} still need a human` : ''),
);
for (const k of unresolved) console.log(`  ? ${k}`);
