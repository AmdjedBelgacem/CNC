#!/usr/bin/env node
/**
 * Rebrand CMS/database content to "Baroot CNC Solutions".
 *
 * Why this is a script and not a find-and-replace in the repo: after the code-level brand
 * pass, four competing strings were still served on indexable pages, and all of them live in
 * the database, not in source —
 *
 *   /            "Machinist Pro Master Multi-Axis Credential"  (testimonial + homepage copy)
 *   /courses/... "We'll use Machinist Pro to: ..."             (lesson body)
 *   /about       "TITANS of Manufacturing is on a mission ..."  (page layout block)
 *
 * A crawler reads those strings, so leaving them undermines the whole point of consolidating
 * on one canonical name. They can only be fixed in the rows.
 *
 * SAFETY: dry run by default. Nothing is written without --apply, and --apply also requires
 * --confirm-production because this rewrites live content. Every affected row is printed
 * with its id first.
 *
 * Usage:
 *   node scripts/rebrand-cms-content.mjs                     # report only
 *   node scripts/rebrand-cms-content.mjs --apply             # write (dev/local DB)
 *   node scripts/rebrand-cms-content.mjs --apply --confirm-production
 *
 * Requires DATABASE_URL. Not committed with any credentials.
 */
import postgres from 'postgres';

const BRAND = 'Baroot CNC Solutions';

// Longest first: "TITANS of Manufacturing" must be replaced before "TITANS", or the longer
// string is left half-rewritten.
const REPLACEMENTS = [
  ['TITANS of Manufacturing', BRAND],
  ['TITANS CNC Academy', BRAND],
  ['Machinist Pro Master Multi-Axis Credential', `${BRAND} Master Multi-Axis Credential`],
  ['Titans of CNC', BRAND],
  ['TITANS Academy', BRAND],
  ['Machinist Pro', BRAND],
  ['Ahmad CNC', BRAND],
];

const apply = process.argv.includes('--apply');
const confirmProduction = process.argv.includes('--confirm-production');

if (apply && !confirmProduction) {
  console.error(
    'rebrand: --apply also requires --confirm-production.\n' +
      '  This rewrites live CMS content. Re-run with both flags once you have a backup.',
  );
  process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('rebrand: DATABASE_URL must be set.');
  process.exit(2);
}

/** Recursively rewrite every string in a JSON value. Returns [newValue, changed]. */
function rewrite(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
    return [out, out !== value];
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const [v, c] = rewrite(entry);
      changed ||= c;
      return v;
    });
    return [next, changed];
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      const [v, c] = rewrite(entry);
      changed ||= c;
      next[key] = v;
    }
    return [next, changed];
  }
  return [value, false];
}

function preview(label, id, slug, before, after) {
  console.log(`  ${label} ${slug ? `(${slug}) ` : ''}id=${id}`);
  for (const [from] of REPLACEMENTS) {
    if (before.includes(from)) {
      console.log(`      "${from}" -> "${after.includes(from) ? from : '(replaced)'}"`);
    }
  }
}

const sql = postgres(url, { max: 1 });

try {
  let touched = 0;

  // 1. CMS pages: layout JSON + translations JSON + SEO fields.
  const pageRows = await sql`SELECT id, slug, title, seo_title, seo_description, layout, translations FROM pages`;
  for (const row of pageRows) {
    const [layout, layoutChanged] = rewrite(row.layout);
    const [translations, translationsChanged] = rewrite(row.translations);
    const [seoTitle, seoTitleChanged] = rewrite(row.seo_title ?? '');
    const [seoDescription, seoDescriptionChanged] = rewrite(row.seo_description ?? '');
    if (!(layoutChanged || translationsChanged || seoTitleChanged || seoDescriptionChanged)) continue;

    touched += 1;
    const before = JSON.stringify([row.layout, row.translations, row.seo_title, row.seo_description]);
    preview('page', row.id, row.slug, before, JSON.stringify([layout, translations, seoTitle, seoDescription]));
    if (apply) {
      await sql`UPDATE pages SET layout = ${sql.json(layout)},
        translations = ${translations ? sql.json(translations) : null},
        seo_title = ${seoTitle || null}, seo_description = ${seoDescription || null}
        WHERE id = ${row.id}`;
    }
  }

  // 2. Course copy: title/subtitle/description/seo fields on courses, series and lessons.
  for (const table of ['courses', 'course_series', 'lessons']) {
    const rows = await sql.unsafe(
      `SELECT id, title, subtitle, description, seo_title, seo_description FROM ${table}
       WHERE COALESCE(title,'') || COALESCE(subtitle,'') || COALESCE(description,'')
          || COALESCE(seo_title,'') || COALESCE(seo_description,'') ~ $1`,
      [REPLACEMENTS.map(([from]) => from).join('|')],
    ).catch(() => []);
    for (const row of rows) {
      touched += 1;
      preview(table, row.id, row.title, JSON.stringify(row), '');
      if (apply) {
        const next = {};
        for (const key of ['title', 'subtitle', 'description', 'seo_title', 'seo_description']) {
          const [value] = rewrite(row[key] ?? '');
          next[key] = value || null;
        }
        await sql.unsafe(
          `UPDATE ${table} SET title = $1, subtitle = $2, description = $3, seo_title = $4, seo_description = $5 WHERE id = $6`,
          [next.title, next.subtitle, next.description, next.seo_title, next.seo_description, row.id],
        );
      }
    }
  }

  // 3. Lesson content blocks (JSONB holding the lesson body).
  const lessonBlocks = await sql`
    SELECT id, title, content_blocks FROM lessons
    WHERE COALESCE(content_blocks::text,'') ~ ${REPLACEMENTS.map(([f]) => f).join('|')}`;
  for (const row of lessonBlocks) {
    const [blocks, changed] = rewrite(row.content_blocks);
    if (!changed) continue;
    touched += 1;
    preview('lesson-blocks', row.id, row.title, '', '');
    if (apply) {
      await sql`UPDATE lessons SET content_blocks = ${sql.json(blocks)} WHERE id = ${row.id}`;
    }
  }

  console.log(
    apply
      ? `\nrebrand: applied to ${touched} row(s).`
      : `\nrebrand: ${touched} row(s) would change. Re-run with --apply --confirm-production to write.`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
