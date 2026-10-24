import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Node environment: these specs assert on source text and pure helpers, not on
// rendered components. Anything that needs a DOM should use environment:
// 'jsdom' per file.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.{ts,tsx}'],
    pool: 'forks',
    testTimeout: 20000,
  },
  // The app compiles JSX with the automatic runtime, so specs that import a component (and
  // therefore pull in its JSX) must too — otherwise `React is not defined` at import time.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
});
