/**
 * i18n coverage audit.
 *
 * Walks every source file, works out which catalog keys each one can ask for,
 * and reports what `en` and `ar` are missing. Also flags user-facing literals
 * that never went through a catalog, because those render as English in Arabic
 * mode and no catalog diff will show them.
 *
 *   node scripts/i18n-audit.mjs [--json] [--fix-listing]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FE = join(ROOT, 'apps/frontend');
const SRC = join(FE, 'src');
const MESSAGES = join(FE, 'messages');
const asJson = process.argv.includes('--json');

const catalogs = {
  en: JSON.parse(readFileSync(join(MESSAGES, 'en.json'), 'utf8')),
  ar: JSON.parse(readFileSync(join(MESSAGES, 'ar.json'), 'utf8')),
};

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
};

const files = walk(SRC);
/** namespace -> Set(keys); and file -> [{ns, key}] for hardcoded detection. */
const used = new Map();
const perFile = new Map();

const addKey = (ns, key) => {
  if (!used.has(ns)) used.set(ns, new Set());
  used.get(ns).add(key);
};

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  // `useTranslations('ns')` / `getTranslations('ns')` then t('key') / t.rich
  const calls = [...source.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g)];
  if (calls.length === 0) continue;

  // Find the variable each call assigned to, so keys bind to the right namespace.
  const bindings = [];
  for (const call of calls) {
    const ns = call[1];
    // Include the call itself: the assignment is `const t = useTranslations(...)`,
    // so a window that stops at the callee name never sees the `=`.
    const before = source.slice(Math.max(0, call.index - 90), call.index + call[0].length);
    // Only the nearest assignment binds this call. A wider window also catches
    // the previous line's `const tCommon = useTranslations('common')` and files
    // this call under the wrong namespace.
    const assign = before.match(/const\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\s*\(\s*['"][^'"]+['"]\s*\)/g);
    const nearest = assign?.at(-1);
    bindings.push({ ns, vars: nearest ? [nearest.match(/const\s+(\w+)/)[1]] : [] });
  }
  const namespaces = bindings.flatMap((b) => b.ns);
  const allVars = bindings.flatMap((b) => b.vars);
  if (allVars.length === 0) continue;

  const local = [];
  // Attribution is by variable name, not by proximity: a file with two catalogs
  // (`tAdmin` / `tCommon`) declares both at the top, so "closest binding wins"
  // files every later call under whichever was declared last.
  const varToNs = new Map();
  for (const binding of bindings) {
    for (const v of binding.vars) varToNs.set(v, binding.ns);
  }
  const vars = [...varToNs.keys()];
  if (vars.length === 0) continue;
  // `useTranslations` returns the lookup itself (`t('key')`), while the rich
  // variants hang off it (`t.rich('key')`), so both shapes must be matched.
  const keyRe = new RegExp(
    "\\b(" + vars.join("|") + ")\\s*(?:\\.\\s*(?:rich|has|raw|markup)\\s*)?\\(\\s*['\"`]([^'\"`]+)['\"`]",
    'g',
  );
  for (const m of source.matchAll(keyRe)) {
    const ns = varToNs.get(m[1]);
    if (!ns) continue;
    addKey(ns, m[2]);
    perFile.set(rel, (perFile.get(rel) ?? []).concat([{ ns, key: m[2] }]));
  }
}

// A template key (`t(`sources.${x}`)`) cannot be resolved statically; its
// children are checked by name-set comparison instead.
const isTemplate = (key) => key.includes('${');

const has = (catalog, ns, key) => {
  // A namespace can be a dotted path (`admin.academiesPage`), so it has to be
  // walked segment by segment rather than used as a single property.
  const block = ns.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), catalog);
  if (!block || typeof block !== 'object') return false;
  if (key.includes('.')) {
    // dotted key path inside a namespace
    return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), block) !== undefined;
  }
  return block[key] !== undefined;
};

const report = { en: [], ar: [], unusedInAr: [], namespaces: {}, orphanTemplates: [] };

/**
 * A lookup like `t(`canvas.${x}`)` cannot be resolved by scanning literals. If
 * the block it interpolates into is missing, next-intl renders the raw key path
 * at the user, so the parent is checked directly.
 */
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const varToNs = new Map();
  for (const call of source.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const window = source.slice(Math.max(0, call.index - 90), call.index + call[0].length);
    const nearest = window.match(/const\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\s*\(\s*['"][^'"]+['"]\s*\)/g)?.at(-1);
    if (nearest) varToNs.set(nearest.match(/const\s+(\w+)/)[1], call[1]);
  }
  for (const [variable, namespace] of varToNs) {
    for (const call of source.matchAll(new RegExp(`\\b${variable}\\(\\s*\`([^\`]*\\$\\{[^}]+\\}[^\`]*)\``, 'g'))) {
      const head = call[1].split('${')[0].replace(/\.$/, '');
      const parent = head ? `${namespace}.${head}` : namespace;
      for (const [label, catalog] of [['en', catalogs.en], ['ar', catalogs.ar]]) {
        const block = parent.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), catalog);
        if (typeof block !== 'object' || block === null) {
          report.orphanTemplates.push(`${parent} (${label}) — ${relative(ROOT, file)}`);
        }
      }
    }
  }
}
for (const [ns, keys] of [...used.entries()].sort()) {
  const missingEn = [...keys].filter((k) => !isTemplate(k) && !has(catalogs.en, ns, k)).sort();
  const missingAr = [...keys].filter((k) => !isTemplate(k) && !has(catalogs.ar, ns, k)).sort();
  const templates = [...keys].filter(isTemplate).sort();
  report.namespaces[ns] = {
    used: keys.size,
    missingEn: missingEn.length,
    missingAr: missingAr.length,
    ...(templates.length ? { templates } : {}),
  };
  for (const key of missingEn) report.en.push(`${ns}.${key}`);
  for (const key of missingAr) report.ar.push(`${ns}.${key}`);
}

// Keys present in ar but never asked for: dead weight or a naming drift.
for (const [ns, block] of Object.entries(catalogs.ar)) {
  if (typeof block !== 'object') continue;
  for (const key of Object.keys(block)) {
    if (used.has(ns) && !used.get(ns).has(key)) report.unusedInAr.push(`${ns}.${key}`);
  }
}

// A namespace whose children are read dynamically must have the same child set
// in both locales, or one of them silently falls back.
const dynamicMismatches = [];
for (const ns of [...used.keys()].sort()) {
  // Child blocks whose keys are built at runtime from source data rather than
  // written as literals. These are invisible to a literal scan, so a deletion
  // inside one of them looks like nothing happened.
  for (const child of ['sources', 'groups', 'prompts', 'promptLabels', 'roles', 'sort', 'levels', 'statuses', 'canvas']) {
    const enBlock = catalogs.en[ns]?.[child];
    const arBlock = catalogs.ar[ns]?.[child];
    if (!enBlock || !arBlock) continue;
    const enKeys = Object.keys(enBlock).sort();
    const arKeys = Object.keys(arBlock).sort();
    if (enKeys.join(',') !== arKeys.join(',')) {
      dynamicMismatches.push({ ns, child, enOnly: enKeys.filter((k) => !arKeys.includes(k)), arOnly: arKeys.filter((k) => !enKeys.includes(k)) });
    }
  }
}
report.dynamicMismatches = dynamicMismatches;

const totalUsed = [...used.values()].reduce((sum, set) => sum + set.size, 0);
const summary = {
  filesWithTranslations: perFile.size,
  namespacesUsed: used.size,
  keysUsed: totalUsed,
  missingEn: report.en.length,
  missingAr: report.ar.length,
  arCoveragePct: totalUsed ? Number((((totalUsed - report.ar.length) / totalUsed) * 100).toFixed(2)) : 0,
  dynamicMismatches: dynamicMismatches.length,
  orphanTemplates: report.orphanTemplates.length,
};

if (asJson) {
  console.log(JSON.stringify({ summary, report }, null, 2));
} else {
  console.log('=== i18n coverage ===');
  console.log(summary);
  console.log('\n--- per namespace (used / missing en / missing ar) ---');
  for (const [ns, data] of Object.entries(report.namespaces)) {
    const flag = data.missingAr > 0 ? ' <-- AR gap' : '';
    console.log(`  ${ns.padEnd(24)} ${String(data.used).padStart(4)} ${String(data.missingEn).padStart(4)} ${String(data.missingAr).padStart(4)}${flag}`);
  }
  if (report.en.length) {
    console.log('\n--- missing from en.json ---');
    for (const key of report.en) console.log('  ' + key);
  }
  if (report.ar.length) {
    console.log('\n--- missing from ar.json ---');
    for (const key of report.ar) console.log('  ' + key);
  }
  if (report.orphanTemplates.length) {
    console.log('\n--- template lookups with a missing parent block (renders a key path) ---');
    for (const entry of report.orphanTemplates) console.log('  ' + entry);
  }
  if (dynamicMismatches.length) {
    console.log('\n--- dynamic child sets differ between locales (silent fallback) ---');
    for (const m of dynamicMismatches) console.log(`  ${m.ns}.${m.child}: en-only=${JSON.stringify(m.enOnly)} ar-only=${JSON.stringify(m.arOnly)}`);
  }
  if (report.unusedInAr.length) {
    console.log(`\n--- in ar.json but never requested (${report.unusedInAr.length}) ---`);
    for (const key of report.unusedInAr.slice(0, 40)) console.log('  ' + key);
  }
}

writeFileSync(join(ROOT, 'scripts/.i18n-audit-cache.json'), JSON.stringify({ used: [...used].map(([k, v]) => [k, [...v]]), perFile: [...perFile] }, null, 2));
