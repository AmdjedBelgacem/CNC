import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  resolve(__dirname, '../src/app/(admin)/admin/analytics/page.tsx'),
  'utf8',
);

/**
 * The access-token cookie is a Supabase JWT. Its `role` claim is `authenticated` for every
 * signed-in user, not the tenant role; decoding it as an app role redirected even super admins.
 */
describe('analytics access gate', () => {
  it('does not route on the Supabase token role claim', () => {
    expect(page).not.toMatch(/store\.get\(/);
    expect(page).not.toMatch(/roleFromAccessTokenPayload/);
    expect(page).not.toMatch(/redirect\('\/admin'\)/);
  });

  it('still renders behind the hydrated client gate', () => {
    expect(page).toMatch(/<AnalyticsRoleGate>/);
    expect(page).toMatch(/<AnalyticsDashboardView/);
  });
});
