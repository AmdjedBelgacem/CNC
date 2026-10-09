import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The FX store's server snapshot must not carry request-scoped state.
 *
 * It used to return the live module `state`. On a long-running server that holds whatever the
 * first request fetched, so the first server render showed "Loading live rates…" and every
 * later one showed "Converted at live rates · SAR is our main currency" — while a browser,
 * with its own fresh module state, always started empty. Server and client disagreed, React
 * threw hydration error #418 on `/products`, and whether it happened depended on which
 * request happened to warm the module first.
 *
 * Asserted against the source because `useSyncExternalStore`'s server snapshot cannot be
 * exercised meaningfully without a server render.
 */
const source = readFileSync(resolve(__dirname, '../src/hooks/use-fx-rates.ts'), 'utf8');

describe('useFxRates server snapshot', () => {
  it('returns a fixed empty snapshot rather than the live store', () => {
    expect(source).toMatch(/const getServerSnapshot = \(\) => EMPTY/);
    expect(source).not.toMatch(/const getServerSnapshot = \(\) => state/);
  });

  it('defines that snapshot as empty', () => {
    expect(source).toMatch(/const EMPTY: FxState = \{ data: null, loading: false, error: null \}/);
  });

  it('still fetches rates after hydration, not during it', () => {
    expect(source).toMatch(/useEffect\(\(\) => \{\s*if \(!state\.data\) void ensure\(\)/);
  });

  it('keeps the client snapshot reading live state', () => {
    expect(source).toMatch(/const getSnapshot = \(\) => state/);
  });
});
