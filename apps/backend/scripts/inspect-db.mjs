// Quick DB inspection helper for the Forge redesign verification.
import postgres from 'postgres';

const sql = postgres((process.env.DATABASE_URL || 'postgresql://localhost:5432/cncm'), {
  prepare: false,
});

const tables = [
  'tenants',
  'themes',
  'academies',
  'courses',
  'lessons',
  'users',
  'products',
  'events',
  'posts',
  'builder_pages',
];

try {
  for (const t of tables) {
    try {
      const rows = await sql`select count(*)::int as c from ${sql(t)}`;
      console.log(`${t}: ${rows[0].c}`);
    } catch (e) {
      console.log(`${t}: ERR ${e.message}`);
    }
  }
  const themes = await sql`
    select id, name, status, version, tokens->'fonts' as fonts,
           tokens->'light'->>'primary' as light_primary,
           tokens->'dark'->>'primary' as dark_primary
    from themes order by updated_at desc limit 5`;
  console.log('themes:', JSON.stringify(themes, null, 2));
  const pages = await sql`
    select slug, status, updated_at from builder_pages order by updated_at desc limit 10`;
  console.log('builder_pages:', JSON.stringify(pages, null, 2));
} finally {
  await sql.end();
}
