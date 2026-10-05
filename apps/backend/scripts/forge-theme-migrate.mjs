// Forge redesign: migrate persisted tenant theme + tenant brand colors onto the
// new "Precision Forge" defaults so the published theme stops fighting the new UI.
import postgres from 'postgres';
import { DEFAULT_THEME_TOKENS, DEFAULT_THEME_NAME } from '@titan/shared';

const sql = postgres((process.env.DATABASE_URL || 'postgresql://localhost:5432/cncm'), {
  prepare: false,
});

try {
  const updated = await sql`
    update themes
    set tokens = ${JSON.stringify(DEFAULT_THEME_TOKENS)}::jsonb,
        name = ${DEFAULT_THEME_NAME},
        updated_at = now()
    returning id, name, status, version`;
  console.log('themes migrated:', JSON.stringify(updated));

  // Tenant brand swatches shown in admin settings — align with the new palette.
  const tenants = await sql`
    update tenants
    set primary_color = '#C2410C', secondary_color = '#333F4C', accent_color = '#0F766E'
    returning slug`;
  console.log('tenants recolored:', JSON.stringify(tenants));
} finally {
  await sql.end();
}
