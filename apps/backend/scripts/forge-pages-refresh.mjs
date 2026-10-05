// Forge redesign: refresh stored builder page layouts from the new shared seeds
// so published marketing pages render the new visual system + honest copy.
import postgres from 'postgres';
import { DEFAULT_LAYOUTS } from '@titan/shared';

const sql = postgres((process.env.DATABASE_URL || 'postgresql://localhost:5432/cncm'), {
  prepare: false,
});

try {
  for (const [slug, layout] of Object.entries(DEFAULT_LAYOUTS)) {
    const res = await sql`
      update pages set layout = ${JSON.stringify(layout)}::jsonb, updated_at = now()
      where slug = ${slug}
      returning slug, status`;
    console.log(slug, '->', res.length ? `updated (${res[0].status})` : 'no row (skipped)');
  }
} finally {
  await sql.end();
}
