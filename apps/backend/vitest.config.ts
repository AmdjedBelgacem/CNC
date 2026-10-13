import { defineConfig } from 'vitest/config';

/**
 * Where the suite gets its database.
 *
 * `src/config/config.service.ts` imports `dotenv/config`, so any process that has not already
 * resolved DATABASE_URL picks up `apps/backend/.env` — which points at a live Supabase project.
 * That made `pnpm test` run 77 specs, 13 of which write, against a shared cloud database: rows
 * appeared on the live site, and reads raced with real traffic, which is exactly why
 * `localized-content.spec.ts` passed alone and failed inside the full run.
 *
 * The fix is to decide the URL *before* any spec imports the app. Vitest applies `test.env` to
 * `process.env` ahead of the test module graph, and `dotenv.config()` never overwrites a variable
 * that is already set — so declaring DATABASE_URL here closes the fallback for every spec at once,
 * with no changes to the specs themselves. This mirrors what `.github/workflows/ci.yml` already
 * did with its postgres service container; it just makes local runs behave the same way.
 *
 * Override with TEST_DATABASE_URL for a disposable database of your own. It is validated below so
 * that pointing it at production is a loud failure rather than a quiet regression.
 */
const defaultLocalUrl = 'postgresql://titans:titans@localhost:5432/titans_cnc';
const testDatabaseUrl = process.env.TEST_DATABASE_URL || defaultLocalUrl;

if (/supabase\.(com|co)/i.test(testDatabaseUrl)) {
  throw new Error(
    'TEST_DATABASE_URL points at a Supabase project, which is how tests ended up writing to ' +
      'production. Use a local Postgres (see .github/workflows/ci.yml for the expected ' +
      'image and credentials), or a dedicated throwaway database.',
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Each integration spec builds its own DrizzleService, and its schema
    // safety-net DDL takes AccessExclusiveLock on shared tables. Migrations
    // already cover every column, so tests skip it.
    env: {
      SKIP_SCHEMA_DDL: '1',
      DATABASE_URL: testDatabaseUrl,
    },
    pool: 'forks',
    testTimeout: 20000,
  },
});
