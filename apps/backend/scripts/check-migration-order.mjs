#!/usr/bin/env node
/**
 * Detects ordering inversions in the drizzle migration journal.
 *
 * Local databases were built with `drizzle-kit push`, which never ran these files,
 * so a migration could reference a table or column that a LATER migration creates.
 * Replaying from empty fails on the first such case; this finds all of them at once.
 *
 * For every ordered pair (A before B), it reports when A depends on something B
 * introduces: a CREATE TABLE, or an ADD COLUMN on a table A already touches.
 *
 * Usage: node scripts/check-migration-order.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(root, 'src/database/migrations');
const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'));

const strip = (s) => s.replace(/--[^\n]*/g, ' ');

/** Tables a migration creates. */
function creates(sql) {
  const out = new Set();
  for (const m of strip(sql).matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([\w]+)"?\s*\(/gi)) {
    out.add(m[1]);
  }
  return out;
}

/** Map of table -> columns a migration adds. */
function addedColumns(sql) {
  const out = new Map();
  for (const m of strip(sql).matchAll(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?"?([\w]+)"?\s+ADD\s+(?:COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?)?"?([\w]+)"?/gi,
  )) {
    const [, table, column] = m;
    if (!out.has(table)) out.set(table, new Set());
    out.get(table).add(column);
  }
  return out;
}

/**
 * Tables a migration reads/writes, and columns it names against them.
 *
 * Two shapes matter. Drizzle emits qualified references ("order_items"."col"), but
 * hand-written migrations often use a bare column inside a CHECK or index expression:
 *   ALTER TABLE order_items ADD CONSTRAINT ... CHECK (fulfillment_state IN (...))
 * Those are captured per-table by pairing each ALTER TABLE with its statement body.
 */
function references(sql) {
  const tables = new Set();
  const columns = new Map();
  const note = (table, col) => {
    if (!columns.has(table)) columns.set(table, new Set());
    columns.get(table).add(col);
  };

  for (const m of sql.matchAll(/(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+"?([\w]+)"?/gi)) {
    tables.add(m[1]);
  }
  for (const m of sql.matchAll(/"([\w]+)"\s*\.\s*"([\w]+)"/gi)) {
    note(m[1], m[2]);
  }

  // Bare identifiers inside each ALTER TABLE <table> ... statement.
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?"?([\w]+)"?\s*([\s\S]*?);/gi)) {
    const [, table, body] = m;
    tables.add(table);
    for (const c of body.matchAll(/\b([a-z_][a-z0-9_]*)\b/gi)) {
      // Skip SQL keywords and the table's own name.
      if (/^(ADD|COLUMN|CONSTRAINT|CHECK|NOT|NULL|DEFAULT|REFERENCES|PRIMARY|FOREIGN|KEY|UNIQUE|INDEX|CREATE|DROP|ALTER|ON|DELETE|UPDATE|CASCADE|ACTION|AND|OR|IN|VALUES|CURRENT|TIMESTAMP|BOOLEAN|VARCHAR|TEXT|INTEGER|JSONB|UUID|BIGINT|SERIAL|NOW|date_trunc|true|false)$/i.test(c[1])) continue;
      if (c[1].toLowerCase() === table.toLowerCase()) continue;
      note(table, c[1]);
    }
  }
  return { tables, columns };
}

const entries = journal.entries.map((e) => {
  const sql = strip(readFileSync(join(folder, `${e.tag}.sql`), 'utf8'));
  return {
    tag: e.tag,
    sql,
    created: creates(sql),
    added: addedColumns(sql),
    refs: references(sql),
  };
});

// Fold in on-disk files the journal forgot, so this also guards future omissions.
const onDisk = readdirSync(folder).filter((f) => f.endsWith('.sql')).map((f) => f.replace(/\.sql$/, ''));
const orphans = onDisk.filter((t) => !entries.some((e) => e.tag === t));
if (orphans.length > 0) {
  console.error(`\n${orphans.length} migration(s) on disk are absent from the journal:`);
  orphans.forEach((t) => console.error(`  ${t}`));
  console.error('Run: node scripts/repair-migration-journal.mjs\n');
}

const problems = [];
for (let i = 0; i < entries.length; i += 1) {
  const a = entries[i];
  for (let j = i + 1; j < entries.length; j += 1) {
    const b = entries[j];

    // A references a table that B creates — unless A creates it too.
    for (const table of b.created) {
      if (a.created.has(table)) continue;
      if (a.refs.tables.has(table)) {
        problems.push({
          kind: 'TABLE',
          detail: `"${table}" is created by ${b.tag} (#${j + 1}) but used by ${a.tag} (#${i + 1})`,
        });
      }
    }

    // A names a column on a table that B adds later.
    for (const [table, cols] of b.added) {
      if (!a.refs.columns.has(table)) continue;
      for (const col of cols) {
        // If A adds the column itself, or creates the table outright, then B's
        // ADD COLUMN IF NOT EXISTS is an idempotent no-op and order is irrelevant.
        if (a.created.has(table)) continue;
        if (a.added.get(table)?.has(col)) continue;
        if (a.refs.columns.get(table).has(col)) {
          problems.push({
            kind: 'COLUMN',
            detail: `"${table}"."${col}" is added by ${b.tag} (#${j + 1}) but referenced by ${a.tag} (#${i + 1})`,
          });
        }
      }
    }
  }
}

if (problems.length === 0) {
  console.log(`no ordering inversions across ${entries.length} journal migrations`);
  process.exit(0);
}

console.log(`\n${problems.length} ordering inversion(s) found:\n`);
for (const p of problems) console.log(`  [${p.kind}] ${p.detail}`);
console.log('\nReordering the journal resolves these. Verify with:');
console.log('  node scripts/replay-migrations.mjs <scratch-db>');
process.exit(1);