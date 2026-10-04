/**
 * Baseline the migrations table.
 *
 * Databases created with `drizzle-kit push` (the normal path for local dev) have
 * the full schema but an empty `drizzle.__drizzle_migrations`, so `npm run
 * db:migrate` replays migration 001 and dies on `relation "audit_logs" already
 * exists` — and it can never record the migrations applied after that.
 *
 * This records every journal entry as already applied (hash = sha256 of the file
 * contents, created_at = the journal timestamp, which is exactly what the drizzle
 * migrator writes), so the next `db:migrate` only applies genuinely new files.
 *
 * Safe to re-run: inserts are idempotent per (hash, created_at).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
const migrationFolder = resolve(here, '../src/database/migrations');
const journal = JSON.parse(readFileSync(join(migrationFolder, 'meta/_journal.json'), 'utf8'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const entries = journal.entries.map((entry) => {
  const contents = readFileSync(join(migrationFolder, `${entry.tag}.sql`), 'utf8');
  return {
    tag: entry.tag,
    when: entry.when,
    hash: createHash('sha256').update(contents).digest('hex'),
  };
});

const sql = postgres(connectionString, { prepare: false });

try {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`;

  const existing = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations`;
  const known = new Set(existing.map((row) => `${row.hash}:${row.created_at}`));

  let inserted = 0;
  for (const entry of entries) {
    if (known.has(`${entry.hash}:${entry.when}`)) continue;
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${entry.hash}, ${entry.when})`;
    inserted += 1;
    console.log(`  recorded ${entry.tag}`);
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
  console.log(
    `Baseline complete: ${inserted} recorded now, ${count} total. ` +
      'Run `npm run db:migrate` to apply anything newer.',
  );
} finally {
  await sql.end({ timeout: 5 });
}
