import { describe, expect, it } from 'vitest';

/**
 * Upstash hands out a REST URL and token, not a connection string.
 *
 * The backend runs `ioredis`, which needs `redis://`/`rediss://`. Rather than make an
 * operator hand-build a URL and paste a credential into a hostname, the REST pair is converted:
 * the REST hostname is also the TLS endpoint, the token is the password, user is `default`.
 */
function deriveRedisUrl(env: {
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): string | undefined {
  if (env.REDIS_URL) return env.REDIS_URL;
  const restUrl = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !token) return undefined;
  try {
    const { hostname, port } = new URL(restUrl);
    if (!hostname) return undefined;
    const auth = `${encodeURIComponent('default')}:${encodeURIComponent(token)}`;
    return `rediss://${auth}@${hostname}${port ? `:${port}` : ':6379'}`;
  } catch {
    return undefined;
  }
}

describe('redis connection string derivation', () => {
  const rest = 'https://example.upstash.io';
  const token = 'tok_ABC123';

  it('derives a TLS url from the Upstash REST pair', () => {
    expect(deriveRedisUrl({ UPSTASH_REDIS_REST_URL: rest, UPSTASH_REDIS_REST_TOKEN: token })).toBe(
      'rediss://default:tok_ABC123@example.upstash.io:6379',
    );
  });

  it('an explicit REDIS_URL always wins', () => {
    expect(
      deriveRedisUrl({
        REDIS_URL: 'redis://cache:6379',
        UPSTASH_REDIS_REST_URL: rest,
        UPSTASH_REDIS_REST_TOKEN: token,
      }),
    ).toBe('redis://cache:6379');
  });

  it('returns undefined when nothing is configured', () => {
    expect(deriveRedisUrl({})).toBeUndefined();
  });

  it('requires both halves of the pair', () => {
    expect(deriveRedisUrl({ UPSTASH_REDIS_REST_URL: rest })).toBeUndefined();
    expect(deriveRedisUrl({ UPSTASH_REDIS_REST_TOKEN: token })).toBeUndefined();
  });

  it('honours an explicit port on the REST url', () => {
    expect(
      deriveRedisUrl({
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io:8443',
        UPSTASH_REDIS_REST_TOKEN: token,
      }),
    ).toBe('rediss://default:tok_ABC123@example.upstash.io:8443');
  });

  it('percent-encodes a token containing URL-significant characters', () => {
    const odd = 'a b/c@d:e';
    const url = deriveRedisUrl({ UPSTASH_REDIS_REST_URL: rest, UPSTASH_REDIS_REST_TOKEN: odd })!;
    expect(url).toBe(`rediss://default:${encodeURIComponent(odd)}@example.upstash.io:6379`);
    // And it must round-trip back to the original token.
    expect(decodeURIComponent(url.split(':')[2].split('@')[0])).toBe(odd);
  });

  it('ignores an unparseable rest url instead of throwing', () => {
    expect(
      deriveRedisUrl({ UPSTASH_REDIS_REST_URL: 'not a url', UPSTASH_REDIS_REST_TOKEN: token }),
    ).toBeUndefined();
  });
});
