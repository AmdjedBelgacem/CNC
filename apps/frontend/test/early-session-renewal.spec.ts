import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_RENEW_INTERVAL_MS, markSessionRenewed, sessionRenewalDue } from '@/lib/api-client';

/**
 * The access cookie lives 15 minutes. Signed-in pages now renew it early, so no request meets
 * an expired one, and plain proxy fetches go through the refresh-and-retry helper.
 */
const src = join(__dirname, '..', 'src');

describe('early session renewal', () => {
  beforeEach(() => {
    // Node test environment: give the helpers a window with in-memory storage.
    const store = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('renews well before the 15-minute access cookie expires', () => {
    expect(SESSION_RENEW_INTERVAL_MS).toBeLessThan(15 * 60 * 1000);
  });

  it('is due with no record, and not right after any tab renewed', () => {
    expect(sessionRenewalDue()).toBe(true);
    markSessionRenewed();
    expect(sessionRenewalDue()).toBe(false);
    expect(sessionRenewalDue(SESSION_RENEW_INTERVAL_MS, Date.now() + SESSION_RENEW_INTERVAL_MS + 1)).toBe(true);
  });

  it('runs from the auth provider while signed in', () => {
    const hydration = readFileSync(join(src, 'components/auth/auth-hydration.tsx'), 'utf8');
    expect(hydration).toMatch(/useEarlySessionRenewal\(signedIn\)/);
    expect(hydration).toMatch(/renewSessionEarly\(\)/);
  });
});

describe('proxy fetches refresh on 401', () => {
  it('no client code calls /api/proxy with a bare fetch outside the auth pages', () => {
    const hits = execSync(
      `grep -rnE "(^|[^A-Za-z0-9_.])fetch\\\\([\\\`'\\"]/api/proxy" "${src}" || true`,
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
      .filter((l) => !l.includes('/lib/api-client') && !l.includes('/hooks/use-api-proxy') && !l.includes('/(auth)/'));
    expect(hits).toEqual([]);
  });
});
