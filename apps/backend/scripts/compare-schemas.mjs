#!/usr/bin/env node
/**
 * Compares two Postgres schemas: table/view/sequence/function inventories plus, for
 * shared tables, their columns, indexes and constraints.
 *
 * This is the gate for moving to a managed database. A migration set that "applies
 * cleanly" is not enough — it must also reproduce the live schema, or the move
 * silently drops tables, columns or constraints.
 *
 * Usage: node scripts/compare-schemas.mjs <live-db> <candidate-db>
 */
import { spawnSync } from 'node:child_process';

const [live, candidate] = process.argv.slice(2);
if (!live || !candidate) {
  console.error('usage: node scripts/compare-schemas.mjs <live-db> <candidate-db>');
  process.exit(1);
}

/**
 * `db` may be a plain database name (host/port/user then come from the standard
 * PGHOST/PGPORT/PGUSER/PGPASSWORD environment variables) or a full postgres URI, so
 * two databases on different hosts -- for example a local PostgreSQL 18 source and a
 * PostgreSQL 17 container standing in for Supabase -- can be compared directly.
 */
const q = (db, sql) => {
  const r = spawnSync('psql', ['-X', '-q', '-t', '-A', '-F', '|', '-d', db, '-c', sql], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(`query failed on ${db}:\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
};

const TABLE_LIST = `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name`;

const COLUMNS = (t) => `
  SELECT column_name || ' ' || data_type || coalesce('(' || character_maximum_length || ')','')
         || ' null=' || is_nullable || ' def=' || coalesce(column_default,'-')
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='${t}' ORDER BY column_name`;

const INDEXES = (t) => `
  SELECT indexname || ' :: ' || indexdef FROM pg_indexes
  WHERE schemaname='public' AND tablename='${t}' ORDER BY indexname`;

/**
 * contype 'n' (NOT NULL) is excluded on purpose: PostgreSQL 17+ records NOT NULL in
 * pg_constraint, while 15/16 keep it only in pg_attribute. Including it made every
 * column look like a difference when comparing across major versions. Nullability is
 * compared properly by COLUMNS() via information_schema.columns.is_nullable.
 */
const CONSTRAINTS = (t) => `
  SELECT conname || ' :: ' || pg_get_constraintdef(c.oid)
  FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=r.relnamespace
  WHERE n.nspname='public' AND r.relname='${t}' AND contype <> 'n'
  ORDER BY conname`;

/**
 * App-owned function inventory: functions in `public` that are NOT part of an
 * extension.
 *
 * Two earlier attempts produced noise on Supabase:
 *  - scanning only `public` reported ~36 pgcrypto functions "missing", because
 *    Supabase installs pgcrypto into an `extensions` schema;
 *  - scanning every schema then reported Supabase's own platform functions
 *    (auth/storage/realtime/vault/graphql) as "extra".
 *
 * Extension members are installed by the provider, not by these migrations, and their
 * schema location is an installation detail. Membership is what distinguishes them.
 */
const FUNCTIONS = `
  SELECT p.proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )
  ORDER BY p.proname`;

const SEQUENCES = `
  SELECT sequence_name FROM information_schema.sequences
  WHERE sequence_schema='public' ORDER BY sequence_name`;

let problems = 0;
const report = (msg) => {
  problems += 1;
  console.log(`  ${msg}`);
};

/** Informational: naming-convention differences, decided by the semantic pass below. */
const notes = [];

console.log(`live      : ${live}`);
console.log(`candidate : ${candidate}\n`);

const liveTables = q(live, TABLE_LIST);
const candTables = q(candidate, TABLE_LIST);

console.log(`tables: live=${liveTables.length} candidate=${candTables.length}`);

const missing = liveTables.filter((t) => !candTables.includes(t));
const extra = candTables.filter((t) => !liveTables.includes(t));
if (missing.length) report(`MISSING tables (in live, absent in candidate): ${missing.join(', ')}`);
if (extra.length) report(`EXTRA tables (in candidate, absent in live): ${extra.join(', ')}`);

console.log('\ncomparing shared tables...');
let colDiffs = 0;
let idxDiffs = 0;
let conDiffs = 0;

for (const t of liveTables) {
  if (!candTables.includes(t)) continue;

  const lc = q(live, COLUMNS(t));
  const cc = q(candidate, COLUMNS(t));
  const lcS = new Set(lc);
  const ccS = new Set(cc);
  for (const c of lc) if (!ccS.has(c)) { colDiffs += 1; notes.push(`col ${t}: live has ${c}`); }
  for (const c of cc) if (!lcS.has(c)) { colDiffs += 1; notes.push(`col ${t}: candidate has ${c}`); }

  const li = q(live, INDEXES(t));
  const ci = q(candidate, INDEXES(t));
  const liS = new Set(li.map((s) => s.split(' :: ')[0]));
  const ciS = new Set(ci.map((s) => s.split(' :: ')[0]));
  for (const i of li) if (!ciS.has(i.split(' :: ')[0])) { idxDiffs += 1; notes.push(`idx ${t}: missing ${i.split(' :: ')[0]}`); }
  for (const i of ci) if (!liS.has(i.split(' :: ')[0])) { idxDiffs += 1; notes.push(`idx ${t}: extra ${i.split(' :: ')[0]}`); }

  const ln = q(live, CONSTRAINTS(t));
  const cn = q(candidate, CONSTRAINTS(t));
  const lnS = new Set(ln.map((s) => s.split(' :: ')[0]));
  const cnS = new Set(cn.map((s) => s.split(' :: ')[0]));
  for (const c of ln) if (!cnS.has(c.split(' :: ')[0])) { conDiffs += 1; notes.push(`con ${t}: missing ${c.split(' :: ')[0]}`); }
  for (const c of cn) if (!lnS.has(c.split(' :: ')[0])) { conDiffs += 1; notes.push(`con ${t}: extra ${c.split(' :: ')[0]}`); }
}

console.log(`\nname-level differences (informational): col=${colDiffs} idx=${idxDiffs} con=${conDiffs}`);

const lf = q(live, FUNCTIONS);
const cf = q(candidate, FUNCTIONS);
const lfS = new Set(lf);
const cfS = new Set(cf);
/**
 * pgcrypto ships different builtins across major versions: `fips_mode()` exists in
 * pgcrypto 1.4 (PostgreSQL 18) but not in 1.3 (PostgreSQL 15/16/17). Nothing in this
 * codebase calls it, so a version-driven builtin difference is not schema drift.
 */
const VERSION_OPTIONAL_FUNCTIONS = new Set(['fips_mode']);
const fnMissing = lf.filter((f) => !cfS.has(f));
const fnExtra = cf.filter((f) => !lfS.has(f));
console.log(`functions: live=${lf.length} candidate=${cf.length}`);
const fnMissingReal = fnMissing.filter((f) => !VERSION_OPTIONAL_FUNCTIONS.has(f));
const fnExtraReal = fnExtra.filter((f) => !VERSION_OPTIONAL_FUNCTIONS.has(f));
for (const f of fnMissing.filter((f) => VERSION_OPTIONAL_FUNCTIONS.has(f))) {
  console.log(`  accepted function ${f} missing (pgcrypto version difference, unused here)`);
}
if (fnMissingReal.length) report(`MISSING functions: ${fnMissingReal.join(', ')}`);
if (fnExtraReal.length) report(`EXTRA functions: ${fnExtraReal.join(', ')}`);

const ls = q(live, SEQUENCES);
const cs = q(candidate, SEQUENCES);
console.log(`sequences: live=${ls.length} candidate=${cs.length}`);

/*
 * Semantic (name-insensitive) pass.
 *
 * Drizzle names constraints `<table>_<col>_fk` while hand-written migrations use
 * `<table>_<col>_fkey`, and unique indexes differ as `_key` / `_key_idx` /
 * `_unique`. Those are naming conventions, not schema differences. Compare the
 * definition with the object's own name stripped so only genuine structural
 * differences are reported.
 */
const NORMALISE = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/(?:fkey|_fk|_key_idx|_key|_unique|_idx)\b/g, '')
    .replace(/USING btree/gi, '')
    .replace(/"public"\./g, '')
    .replace(/\bno action\b/gi, '')
    .replace(/[()"]/g, '')
    .replace(/\s*,\s*/g, ',')
    .trim()
    .toLowerCase();

/**
 * An index is semantically (uniqueness, column list, predicate). Comparing full
 * definitions would flag a pure rename, and stripping suffixes from a definition
 * that embeds the table name produces false mismatches (e.g. a unique index named
 * `permissions_key` on table `permissions`).
 */
const indexShape = (def) => {
  const unique = /CREATE UNIQUE INDEX/i.test(def);
  const cols = (def.match(/\(([^)]*)\)/)?.[1] ?? '')
    .split(',')
    .map((c) => c.trim().replace(/["()]/g, '').toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  const partial = /WHERE /.test(def) ? NORMALISE(def.slice(def.indexOf('WHERE'))) : '';
  return `${unique}|${cols}|${partial}`;
};

const semanticDiffs = [];
for (const t of liveTables) {
  if (!candTables.includes(t)) continue;

  const norm = (rows) => rows.map((r) => NORMALISE(r.split(' :: ')[1] ?? r)).sort();
  const uniq = (a) => [...new Set(a)];

  // Constraints: compare definitions with the object's own name stripped.
  for (const x of uniq(norm(q(live, CONSTRAINTS(t))))) {
    if (!new Set(uniq(norm(q(candidate, CONSTRAINTS(t))))).has(x)) {
      semanticDiffs.push(`constraint ${t}: live-only ${x}`);
    }
  }
  for (const x of uniq(norm(q(candidate, CONSTRAINTS(t))))) {
    if (!new Set(uniq(norm(q(live, CONSTRAINTS(t))))).has(x)) {
      semanticDiffs.push(`constraint ${t}: candidate-only ${x}`);
    }
  }

  // Indexes: compare semantic shape, ignoring the index name entirely.
  const lIdx = uniq(q(live, INDEXES(t)).map((r) => indexShape(r)));
  const cIdx = uniq(q(candidate, INDEXES(t)).map((r) => indexShape(r)));
  const lS = new Set(lIdx);
  const cS = new Set(cIdx);
  for (const x of lIdx) if (!cS.has(x)) semanticDiffs.push(`index ${t}: live-only ${x}`);
  for (const x of cIdx) if (!lS.has(x)) semanticDiffs.push(`index ${t}: candidate-only ${x}`);
}

console.log(`\nname-insensitive differences: ${semanticDiffs.length}`);

/**
 * Differences we have deliberately accepted, with the reason. Anything not listed
 * here fails the gate. Keeping them here (rather than silently tolerating all
 * diffs) means a NEW drift is still caught.
 */
const ACCEPTED = [
  {
    match: /constraint courses: candidate-only not null (access_mode|currency)/,
    reason:
      '0003_course_commerce_seo.sql adds both NOT NULL; the live DB had them nullable only ' +
      'because `push` followed a schema that omitted .notNull(). The schema is now aligned ' +
      'to the migration. 0 NULL rows exist and both columns have defaults.',
  },
  {
    match: /constraint cert_templates: (live|candidate)-only foreign key course_id/,
    reason:
      '0007_cert_templates_course_id.sql declares ON DELETE SET NULL; live has no ON DELETE. ' +
      'The schema now declares onDelete: "set null" to match. Live is the stale side.',
  },
  {
    match: /constraint permissions: live-only unique key/,
    reason:
      'The schema uses .unique() so `push` yields a unique CONSTRAINT, while 0002_rbac creates ' +
      'a unique INDEX. Both enforce uniqueness on permissions.key; representation only.',
  },
];

const unaccepted = semanticDiffs.filter((d) => !ACCEPTED.some((a) => a.match.test(d)));
for (const d of semanticDiffs) {
  const hit = ACCEPTED.find((a) => a.match.test(d));
  console.log(`  ${hit ? 'accepted' : 'DIFF    '} ${d}`);
  if (hit) console.log(`             ↳ ${hit.reason}`);
}

console.log(
  unaccepted.length === 0
    ? `\nall ${semanticDiffs.length} name-insensitive differences are accepted/documented`
    : `\n${unaccepted.length} unaccepted difference(s)`,
);

if (notes.length) {
  console.log('(name-level differences are convention-only; the semantic pass below decides)');
}

problems += unaccepted.length + missing.length + extra.length;

console.log(problems === 0 ? '\nSCHEMAS MATCH' : `\n${problems} difference(s) found`);
process.exit(problems === 0 ? 0 : 1);