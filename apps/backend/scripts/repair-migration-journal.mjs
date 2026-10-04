#!/usr/bin/env node
/**
 * Repair the drizzle migration journal.
 *
 * 11 hand-written migrations exist as .sql files but were never added to
 * meta/_journal.json, so `drizzle-kit migrate` silently skipped them:
 *
 *   0006_cert_templates_active   0007_cert_templates_course_id
 *   0008_course_auto_issue       001_add_portfolio_columns
 *   002_builder_system           003_saved_sections
 *   004_academies                005_academy_seo_image
 *   006_lesson_thumbnail         007_user_theme_tokens
 *   009_finance_budgets
 *
 * Local databases hid this because they were created with `drizzle-kit push`,
 * which writes the schema without recording history. Building a fresh database
 * (required for Supabase) would have produced a schema missing the admin builder,
 * academies, portfolio, certificates and finance tables.
 *
 * Insertion order is derived from DDL dependencies, not from filename order:
 * every FK target (users, courses, lessons, cert_templates, user_preferences,
 * user_portfolio_items, tenants) is created by 0000, and `academies` is created by
 * 004_academies, so 005 must follow it.
 *
 * Idempotent: safe to re-run. Entries already present are left untouched.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationFolder = resolve(here, '../src/database/migrations');
const journalPath = join(migrationFolder, 'meta/_journal.json');

/**
 * Insertion order, derived from DDL dependencies rather than filename order.
 * Every FK target (users, courses, lessons, cert_templates, user_preferences,
 * user_portfolio_items, tenants) is created by 0000; `academies` is created by
 * 004_academies, so 005 and 0008 must follow it.
 */
const ORDER = [
  '001_add_portfolio_columns',
  '002_builder_system',
  '003_saved_sections',
  '004_academies',
  '005_academy_seo_image',
  '006_lesson_thumbnail',
  '0006_cert_templates_active',
  '0007_cert_templates_course_id',
  '007_user_theme_tokens',
  '0008_course_auto_issue',
  '009_finance_budgets',
];

const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
const present = new Set(journal.entries.map((entry) => entry.tag));

const onDisk = new Set(
  readdirSync(migrationFolder)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, '')),
);

// Derive the gap from disk so a typo here can never silently skip a file.
const orphaned = [...onDisk].filter((tag) => !present.has(tag));
const knownOrder = ORDER.filter((tag) => orphaned.includes(tag));
const unplanned = orphaned.filter((tag) => !ORDER.includes(tag));
if (unplanned.length > 0) {
  console.error(
    `ERROR: ${unplanned.length} orphaned migration(s) missing from ORDER: ${unplanned.join(', ')}\n` +
      'Add them with a dependency-justified position, then re-run.',
  );
  process.exit(1);
}

const toInsert = knownOrder;

let changed = false;
if (toInsert.length === 0) {
  console.log('no orphaned migrations on disk');
} else {
  changed = true;
}

// Slot them in immediately after 0000 (which creates every base table they touch).
const anchor = journal.entries.findIndex((e) => e.tag === '0000_fast_princess_powerful');
if (anchor === -1) throw new Error('anchor migration 0000_fast_princess_powerful not found in journal');

if (toInsert.length > 0) {
  // Keep `when` strictly increasing so drizzle orders by timestamp, not insertion.
  let cursor = journal.entries[anchor].when;
  const added = toInsert.map((tag, i) => {
    cursor += 1000 + i;
    return { idx: 0, version: '7', when: cursor, tag, breakpoints: true };
  });

  journal.entries = [
    ...journal.entries.slice(0, anchor + 1),
    ...added,
    ...journal.entries.slice(anchor + 1),
  ];
  console.log(`added ${added.length} migration(s) to the journal:`);
  added.forEach((e) => console.log(`  + ${e.tag}`));
}

/**
 * Pre-existing inversion: 021_product_purchases adds a CHECK constraint on
 * order_items.fulfillment_state, which 020_moyasar_orders_google_integrations
 * introduces — but 020 sat *later* in the journal, so a replay from empty failed.
 *
 * drizzle applies entries in `when` order, so both the array position and the
 * timestamp have to move. Move 020 to sit immediately before 021, then rebuild
 * timestamps monotonically across the finished order.
 */
const MOYASAR = '020_moyasar_orders_google_integrations';
const PRODUCT_PURCHASES = '021_product_purchases';
const moyasarIdx = journal.entries.findIndex((e) => e.tag === MOYASAR);
const purchasesIdx = journal.entries.findIndex((e) => e.tag === PRODUCT_PURCHASES);

if (moyasarIdx > purchasesIdx && moyasarIdx !== -1 && purchasesIdx !== -1) {
  const [moyasar] = journal.entries.splice(moyasarIdx, 1);
  const target = journal.entries.findIndex((e) => e.tag === PRODUCT_PURCHASES);
  journal.entries.splice(target, 0, moyasar);
  console.log(`\nreordered: ${MOYASAR} now precedes ${PRODUCT_PURCHASES}`);
}

// Rebuild timestamps to match the final array order exactly.
let stamp = journal.entries[0].when;
for (const entry of journal.entries) {
  entry.when = stamp;
  stamp += 1000;
}
journal.entries.forEach((entry, i) => {
  entry.idx = i;
});

writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

console.log(`\njournal now has ${journal.entries.length} entries`);

const stillMissing = [...onDisk].filter((t) => !journal.entries.some((e) => e.tag === t));
if (stillMissing.length > 0) {
  console.error(`\nWARNING: still absent from journal: ${stillMissing.join(', ')}`);
  process.exit(1);
}
console.log('every .sql file on disk is now represented in the journal');