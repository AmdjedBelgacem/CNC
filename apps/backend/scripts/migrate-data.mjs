#!/usr/bin/env node
/**
 * Phase 1 data migration: copy table data from a source database into a target that
 * already has the schema (created by `npm run db:migrate`).
 *
 * Uses pg_dump/pg_restore rather than hand-written INSERTs because it handles
 * foreign-key ordering, identity/serial columns, large payloads and bytea correctly.
 *
 *  - Schema is NOT copied: the target schema comes from the numbered migrations, so
 *    the two sides are guaranteed to agree (see scripts/compare-schemas.mjs).
 *  - The drizzle migration table is excluded: the target's history must come from its
 *    own migrate run, not from a push-created source.
 *  - Verification compares per-table row counts afterwards and fails on any mismatch.
 *
 * Usage:
 *   node scripts/migrate-data.mjs --source <db> --target <db> [--dry-run] [--data-only]
 *
 * pg_dump/pg_restore speak the wire protocol, so the two databases need not be on the
 * same host — this works unchanged against a remote Supabase instance.
 *
 * Either argument may be a plain database name (host/port/user from PGHOST/PGPORT/
 * PGUSER/PGPASSWORD) or a full postgres:// URI.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const source = flag('source');
const target = flag('target');
const dryRun = has('dry-run');
const shouldTruncate = has('truncate');

/**
 * Supabase's pooler returns an EMPTY search_path, so every unqualified reference
 * (`SELECT count(*) FROM "users"`, `TRUNCATE TABLE "tenants"`) fails with
 * `relation ... does not exist` — even though the data is there. libpq honours the
 * `options` connection parameter, so appending it fixes every psql/pg_dump call in
 * this script at once, and is a no-op on a normal PostgreSQL server.
 */
function withSearchPath(db) {
  if (!db.includes('://')) return db;
  if (/[?&]options=/.test(db)) return db;
  return `${db}${db.includes('?') ? '&' : '?'}options=${encodeURIComponent('-c search_path=public')}`;
}

const targetDb = withSearchPath(target);

if (!source || !target) {
  console.error('usage: node scripts/migrate-data.mjs --source <db> --target <db> [--dry-run]');
  process.exit(1);
}

/** Row counts per table from a database. */
function tableCounts(db) {
  // Normalise here too: callers pass the raw target, and an unqualified count would
  // fail against Supabase's empty search_path and silently look like zero rows.
  const conn = withSearchPath(db);
  const names = spawnSync(
    'psql',
    [
      '-X', '-q', '-t', '-A', '-d', conn, '-c',
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
         AND table_name <> 'drizzle' AND table_name NOT LIKE 'drizzle\\_%'
       ORDER BY table_name`,
    ],
    { encoding: 'utf8' },
  );
  if (names.status !== 0) {
    console.error(`cannot list tables in ${db}:\n${names.stderr}`);
    process.exit(1);
  }
  const tables = names.stdout.split('\n').map((l) => l.trim()).filter(Boolean);

  const counts = new Map();
  for (const t of tables) {
    const r = spawnSync('psql', ['-X', '-q', '-t', '-A', '-d', conn, '-c', `SELECT count(*) FROM "${t}"`], {
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      console.error(`count failed for ${db}/${t}: ${(r.stderr || '').trim().slice(0, 200)}`);
      process.exit(1);
    }
    counts.set(t, Number((r.stdout || '0').trim() || 0));
  }
  return { tables, counts };
}

const before = tableCounts(source);
const populated = before.tables.filter((t) => before.counts.get(t) > 0);

console.log(`source : ${source}`);
console.log(`target : ${target}`);
console.log(`tables : ${before.tables.length} (${populated.length} with data)\n`);

if (populated.length === 0) {
  console.log('nothing to copy');
  process.exit(0);
}

populated.forEach((t) => console.log(`  ${String(before.counts.get(t)).padStart(8)}  ${t}`));
console.log('');

if (dryRun) {
  console.log(`DRY RUN — would restore ${populated.length} tables into ${target}`);
  process.exit(0);
}

if (before.tables.length === 0) {
  console.error('source has no tables — check the database name');
  process.exit(1);
}

// Target must already have the schema.
const targetTables = tableCounts(target).tables;
if (targetTables.length === 0) {
  console.error(`target ${target} has no tables. Run \`npm run db:migrate\` against it first.`);
  process.exit(1);
}
const missingOnTarget = before.tables.filter((t) => !targetTables.includes(t));
if (missingOnTarget.length > 0) {
  console.error(`target is missing ${missingOnTarget.length} table(s): ${missingOnTarget.join(', ')}`);
  console.error('Refusing to copy data into an incomplete schema.');
  process.exit(1);
}

// ---------------------------------------------------------------- restore
/**
 * Several migrations insert seed rows (a demo tenant, the RBAC catalogue). Restoring
 * the source on top of those collides on primary keys, e.g.
 * `duplicate key value violates unique constraint "tenants_pkey"`. `--truncate` clears
 * the target first so the source is authoritative. It is opt-in because it destroys
 * target data.
 */
if (shouldTruncate) {
  console.log('truncating target tables (--truncate)…');
  const list = spawnSync(
    'psql',
    ['-X', '-q', '-t', '-A', '-d', targetDb, '-c',
     // Schema-qualify as well as quote: Supabase's pooler hands back an empty
     // search_path, so an unqualified name fails even though quote_ident looks safe.
     `SELECT 'public.' || quote_ident(table_name) FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
        AND table_name <> 'drizzle' AND table_name NOT LIKE 'drizzle\\_%'`],
    { encoding: 'utf8' },
  );
  if (list.status !== 0) {
    console.error(`could not list target tables:\n${(list.stderr || '').slice(0, 500)}`);
    process.exit(1);
  }
  const schema = (list.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  // Single statement so it cannot fail partway through leaving a half-cleared schema.
  const sql = `TRUNCATE TABLE ${schema.join(', ')} RESTART IDENTITY CASCADE;`;
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', targetDb, '-c', sql], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(`truncate failed:\n${(r.stderr || '').slice(0, 1000)}`);
    process.exit(1);
  }
  console.log(`  cleared ${schema.length} tables`);
}

console.log('restoring data (pg_dump | filter | psql)…');

/** Target's server_version_num, e.g. 150019 / 170009 / 180003. */
function targetVersionNum(db) {
  const r = spawnSync('psql', ['-X', '-q', '-t', '-A', '-d', db, '-c', 'SHOW server_version_num'], {
    encoding: 'utf8',
  });
  return Number((r.stdout || '').trim()) || 0;
}

const targetVersion = targetVersionNum(target);

/**
 * GUCs a newer pg_dump may emit that an older server rejects outright.
 * `transaction_timeout` landed in PostgreSQL 17, so dumping from 18 and restoring into
 * 15/16 fails with: ERROR: unrecognized configuration parameter "transaction_timeout".
 */
const VERSION_GATED_GUCS = [{ name: 'transaction_timeout', minVersion: 170000 }];
const unsupportedGucs = VERSION_GATED_GUCS.filter((g) => targetVersion > 0 && targetVersion < g.minVersion);
if (unsupportedGucs.length) {
  console.log(
    `  target is older than the dump source; stripping ${unsupportedGucs.map((g) => g.name).join(', ')}`,
  );
}

const dump = spawnSync(
  'pg_dump',
  [
    '--dbname', source,
    '--data-only',
    '--no-owner',
    '--no-privileges',
    '--no-comments',
    '--quote-all-identifiers',
    '--exclude-table', 'drizzle',
    '--exclude-table', 'drizzle.*',
  ],
  { encoding: 'buffer', maxBuffer: 1024 * 1024 * 1024 },
);

if (dump.status !== 0) {
  console.error(`pg_dump failed:\n${dump.stderr?.toString().slice(0, 2000)}`);
  process.exit(1);
}
console.log(`  dumped ${(dump.stdout.length / 1024 / 1024).toFixed(1)} MB`);

/**
 * Strip `SET <guc>` statements the target server does not recognise.
 *
 * Uses a temp file rather than a hand-rolled pipe: writing a large dump into psql's
 * stdin without honouring backpressure produces EPIPE the moment psql exits early,
 * which hides the real error.
 */
function filterDump(buffer) {
  // Spread the array, THEN join. `[...arr.join('|')]` spreads the resulting *string*
  // into individual characters and builds `(t,r,a,n,...)`, which silently matches
  // nothing and lets every unsupported SET through.
  const names = [...unsupportedGucs.map((g) => g.name)].join('|');
  const pattern = new RegExp(`^SET\\s+(${names})\\b`, 'i');
  let dropped = 0;
  const out = buffer
    .toString('utf8')
    .split('\n')
    .filter((line) => {
      if (unsupportedGucs.length > 0 && pattern.test(line)) {
        dropped += 1;
        return false;
      }
      return true;
    })
    .join('\n');
  return { sql: out, dropped };
}

const { sql: filteredSql, dropped } = filterDump(dump.stdout);
const tmpFile = join(tmpdir(), `migrate-data-${process.pid}.sql`);
writeFileSync(tmpFile, filteredSql);

let restore;
try {
  restore = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', targetDb, '-f', tmpFile], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
  });
} finally {
  rmSync(tmpFile, { force: true });
}

if (restore.status !== 0) {
  console.error(`restore failed:\n${(restore.stderr || '').slice(0, 3000)}`);
  process.exit(1);
}
console.log(`  restored${dropped ? ` (stripped ${dropped} unsupported SET)` : ''}`);

// ----------------------------------------------------------------- verify
console.log('\nverifying row counts…');
const after = tableCounts(target);
let mismatches = 0;

for (const t of before.tables) {
  const s = before.counts.get(t) ?? 0;
  const d = after.counts.get(t) ?? -1;
  if (s !== d) {
    mismatches += 1;
    console.log(`  MISMATCH ${t}: source=${s} target=${d}`);
  }
}

console.log(
  mismatches === 0
    ? `\nDATA MIGRATION VERIFIED — all ${before.tables.length} tables match`
    : `\n${mismatches} of ${before.tables.length} tables did not match`,
);
process.exit(mismatches === 0 ? 0 : 1);