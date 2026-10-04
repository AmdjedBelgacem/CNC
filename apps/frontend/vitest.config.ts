import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Node environment: these specs assert on source text and pure helpers, not on
// rendered components. Anything that needs a DOM should use environment:
// 'jsdom' per file.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 20000,
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
});
