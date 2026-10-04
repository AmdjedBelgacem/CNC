import { describe, it, expect } from 'vitest';
import { apiDocsEnabled, assertAuthSecret } from '../src/main';

/**
 * `/api/docs` and `/api/docs-json` were served in every environment, with no
 * authentication and no rate limit. That is a complete, machine-readable route
 * map — every path, every DTO, which guards apply — handed to an unauthenticated
 * caller. It turned every other bug in this report into a targeted request
 * instead of a hunt.
 */
describe('API docs are not exposed in production', () => {
  it('is off in production by default', () => {
    expect(apiDocsEnabled({ NODE_ENV: 'production' } as never)).toBe(false);
  });

  it('is on in development so the docs remain usable', () => {
    expect(apiDocsEnabled({ NODE_ENV: 'development' } as never)).toBe(true);
    expect(apiDocsEnabled({} as never)).toBe(true);
  });

  it('can be forced on deliberately, and forced off everywhere', () => {
    expect(apiDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: 'true' } as never)).toBe(true);
    expect(apiDocsEnabled({ NODE_ENV: 'development', API_DOCS_ENABLED: 'false' } as never)).toBe(false);
  });

  it('treats any unrecognised value as "not explicitly enabled"', () => {
    // A typo must fail closed, not open.
    expect(apiDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: 'yes' } as never)).toBe(false);
    expect(apiDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: '1' } as never)).toBe(false);
  });
});

/**
 * The cookie plugin fell back to the literal string `cookie-secret-change-me`
 * when `AUTH_SECRET` was unset. Every signed cookie in that deployment would be
 * forgeable by anyone who has read the source, which is not a secret.
 */
describe('a missing cookie secret stops a production boot', () => {
  const prod = { NODE_ENV: 'production' } as never;
  const withSecret = (v: string) => ({ NODE_ENV: 'production', AUTH_SECRET: v }) as never;

  it('throws when AUTH_SECRET is absent', () => {
    expect(() => assertAuthSecret(prod)).toThrow(/AUTH_SECRET/);
  });

  it('throws when AUTH_SECRET is still the placeholder', () => {
    expect(() => assertAuthSecret(withSecret('cookie-secret-change-me'))).toThrow(/placeholder/);
  });

  it('throws on an obviously weak secret', () => {
    expect(() => assertAuthSecret(withSecret('a'))).toThrow(/AUTH_SECRET/);
  });

  it('passes with a real secret', () => {
    expect(() => assertAuthSecret(withSecret('a-32-byte-random-value-from-vault'))).not.toThrow();
  });

  it('still allows a development boot, but says so', () => {
    expect(() => assertAuthSecret({ NODE_ENV: 'development' } as never)).not.toThrow();
  });
});
