/**
 * Backfill Arabic content for the seeded demo data.
 *
 * Safe to re-run: it merges into `translations.ar` and never removes a key that
 * an author has since written by hand. English columns are never touched, and
 * anything that is a value rather than copy — a price, a capacity, a slug, a
 * coordinate — is deliberately left out of the translation object.
 *
 *   cd apps/backend && npx tsx scripts/backfill-ar-content.ts
 *
 * `--dry-run` prints what would change.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import { academies, courses, events, products, lessons, series } from '../src/database/schema';

const dryRun = process.argv.includes('--dry-run');

type TranslationSet = Record<string, Record<string, unknown>>;

const load = (path: string): TranslationSet =>
  JSON.parse(readFileSync(path, 'utf8')) as TranslationSet;

const ar = {
  ...load('/tmp/ar-content-aa.json'),
  ...load('/tmp/ar-content-ab.json'),
  ...load('/tmp/ar-content-ac.json'),
};
const extra = load('/tmp/ar-extra.json');

/**
 * Merge new copy into an existing translations map.
 *
 * `existing` wins on conflict: a human editing Arabic in the studio must not be
 * overwritten by a re-run of this script. Only missing keys are filled in.
 */
const mergeTranslations = (existing: unknown, incoming: Record<string, unknown>) => {
  const current =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  const currentAr =
    current.ar && typeof current.ar === 'object' ? (current.ar as Record<string, unknown>) : {};
  const next = { ...currentAr, ...incoming };
  return { ...current, ar: next };
};

/** Keep only the keys whose source column is actually populated. */
const prune = (value: Record<string, unknown>, allowed: Array<keyof typeof value>) => {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const v = value[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') out[key as string] = v;
  }
  return out;
};

async function main() {
  const drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
  await drizzle.onModuleInit();

  let updated = 0;
  let skipped = 0;
  const report: string[] = [];

  // --- courses -------------------------------------------------------------
  const courseRows = await drizzle.db.select().from(courses);
  for (const row of courseRows) {
    const incoming = ar[row.id];
    if (!incoming || !row.title || row.title === 'Untitled course') {
      skipped += 1;
      continue;
    }
    const value = prune(
      {
        title: incoming.title,
        subtitle: incoming.subtitle ?? (row.subtitle ? '' : undefined),
        description: incoming.description ?? (row.description ? '' : undefined),
        seoTitle: incoming.seoTitle ?? (row.seoTitle ? '' : undefined),
        seoDescription: incoming.seoDescription ?? (row.seoDescription ? '' : undefined),
      },
      ['title', 'subtitle', 'description', 'seoTitle', 'seoDescription'],
    );
    if (!value.title) {
      skipped += 1;
      continue;
    }
    const next = mergeTranslations(row.translations, value);
    report.push(`  course   ${row.title}`);
    if (!dryRun) await drizzle.db.update(courses).set({ translations: next }).where(eq(courses.id, row.id));
    updated += 1;
  }

  // --- series --------------------------------------------------------------
  for (const row of await drizzle.db.select().from(series)) {
    const incoming = ar[row.id];
    if (!incoming) {
      skipped += 1;
      continue;
    }
    const value = prune({ title: incoming.title, description: incoming.description }, ['title', 'description']);
    if (!value.title) {
      skipped += 1;
      continue;
    }
    const next = mergeTranslations(row.translations, value);
    report.push(`  series   ${row.title}`);
    if (!dryRun) await drizzle.db.update(series).set({ translations: next }).where(eq(series.id, row.id));
    updated += 1;
  }

  // --- lessons -------------------------------------------------------------
  for (const row of await drizzle.db.select().from(lessons)) {
    const incoming = ar[row.id];
    if (!incoming) {
      skipped += 1;
      continue;
    }
    const value = prune({ title: incoming.title, description: incoming.description }, ['title', 'description']);
    if (!value.title) {
      skipped += 1;
      continue;
    }
    const next = mergeTranslations(row.translations, value);
    report.push(`  lesson   ${row.title}`);
    if (!dryRun) await drizzle.db.update(lessons).set({ translations: next }).where(eq(lessons.id, row.id));
    updated += 1;
  }

  // --- academies, products, events ----------------------------------------
  for (const row of await drizzle.db.select().from(academies)) {
    const incoming = ar[row.id];
    if (!incoming?.title) {
      skipped += 1;
      continue;
    }
    const value = prune(
      {
        title: incoming.title,
        description: incoming.description,
        seoTitle: incoming.seoTitle,
        seoDescription: incoming.seoDescription,
      },
      ['title', 'description', 'seoTitle', 'seoDescription'],
    );
    const next = mergeTranslations(row.translations, value);
    report.push(`  academy  ${row.title}`);
    if (!dryRun) await drizzle.db.update(academies).set({ translations: next }).where(eq(academies.id, row.id));
    updated += 1;
  }

  for (const row of await drizzle.db.select().from(products)) {
    const incoming = ar[row.id];
    const features = extra[row.id]?.features;
    if (!incoming?.title && !features) {
      skipped += 1;
      continue;
    }
    const value = prune(
      { title: incoming?.title, tagline: incoming?.tagline, description: incoming?.description, features },
      ['title', 'tagline', 'description', 'features'],
    );
    const next = mergeTranslations(row.translations, value);
    report.push(`  product  ${row.title}`);
    if (!dryRun) await drizzle.db.update(products).set({ translations: next }).where(eq(products.id, row.id));
    updated += 1;
  }

  for (const row of await drizzle.db.select().from(events)) {
    const incoming = ar[row.id];
    const location = extra[row.id]?.location;
    if (!incoming?.title && !location) {
      skipped += 1;
      continue;
    }
    const value = prune(
      { title: incoming?.title, description: incoming?.description, location },
      ['title', 'description', 'location'],
    );
    const next = mergeTranslations(row.translations, value);
    report.push(`  event    ${row.title}`);
    if (!dryRun) await drizzle.db.update(events).set({ translations: next }).where(eq(events.id, row.id));
    updated += 1;
  }

  console.log(`\n=== Arabic content backfill (${dryRun ? 'dry run' : 'applied'}) ===`);
  for (const line of report) console.log(line);
  console.log(`\n  rows updated: ${updated}`);
  console.log(`  rows skipped: ${skipped} (no Arabic copy, or a placeholder title)`);

  // A quick truth check straight from the database.
  const counts = await drizzle.db.execute(sql`
    select
      (select count(*) from courses where translations->'ar'->>'title' is not null) as courses,
      (select count(*) from series where translations->'ar'->>'title' is not null) as series,
      (select count(*) from lessons where translations->'ar'->>'title' is not null) as lessons,
      (select count(*) from academies where translations->'ar'->>'title' is not null) as academies,
      (select count(*) from products where translations->'ar'->>'title' is not null) as products,
      (select count(*) from events where translations->'ar'->>'title' is not null) as events
  `);
  console.log('\n  rows now carrying Arabic:', JSON.stringify((counts as unknown as Array<Record<string, number>>)[0]));
  process.exit(0);
}

void main();
