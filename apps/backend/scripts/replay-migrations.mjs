#!/usr/bin/env node
/**
 * Replays every journal migration in order against a target database, reporting the
 * exact file and statement that fails (drizzle-kit's output hides the file).
 *
 * Splitting uses drizzle's `--> statement-breakpoint` marker. macOS ships BSD awk,
 * which cannot use a multi-character record separator, so this is done in Node.
 *
 * Usage: node scripts/replay-migrations.mjs <target-database>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/replay-migrations.mjs <target-database>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(root, 'src/database/migrations');
const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'));
const onDisk = new Set(
  readdirSync(folder).filter((f) => f.endsWith('.sql')).map((f) => f.replace(/\.sql$/, '')),
);

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function apply(sql) {
  return spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-X', '-d', target, '-c', sql], {
    encoding: 'utf8',
  });
}

let applied = 0;
for (const entry of journal.entries) {
  const tag = entry.tag;
  if (!onDisk.has(tag)) fail(`journal entry has no matching .sql file: ${tag}`);

  const sql = readFileSync(join(folder, `${tag}.sql`), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const [index, statement] of statements.entries()) {
    const result = apply(statement);
    if (result.status !== 0) {
      console.error(`\nFAILED in ${tag}.sql (statement ${index + 1} of ${statements.length})`);
      console.error('--- statement ---');
      console.error(statement.length > 700 ? `${statement.slice(0, 700)}…` : statement);
      console.error('--- psql ---');
      console.error((result.stderr || result.stdout || '').trim());
      process.exit(1);
    }
  }
  applied += 1;
  process.stdout.write('.');
}

console.log(`\napplied ${applied} migrations successfully to ${target}`);