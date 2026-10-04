import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Each integration spec builds its own DrizzleService, and its schema
    // safety-net DDL takes AccessExclusiveLock on shared tables. Migrations
    // already cover every column, so tests skip it.
    env: { SKIP_SCHEMA_DDL: '1' },
    pool: 'forks',
    testTimeout: 20000,
  },
});
