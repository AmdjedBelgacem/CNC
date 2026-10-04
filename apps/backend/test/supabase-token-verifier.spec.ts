import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseTokenVerifier } from '../src/modules/auth/supabase-token.verifier';

const SECRET = 'super-secret-jwt-value-with-enough-entropy';

const verifier = (over: Record<string, unknown> = {}) =>
  new SupabaseTokenVerifier({ get: (k: string) => (k in over ? over[k] : undefined) } as never);

const b64 = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const sign = (claims: Record<string, unknown>, secret = SECRET, alg = 'HS256') => {
  const h = b64({ alg, typ: 'JWT' });
  const p = b64(claims);
  const sig = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
};

const future = () => Math.floor(Date.now() / 1000) + 3600;

describe('SupabaseTokenVerifier (legacy HS256)', () => {
  it('is disabled unless SUPABASE_AUTH_ENABLED is exactly "true"', () => {
    expect(verifier({ SUPABASE_AUTH_ENABLED: false }).enabled).toBe(false);
    expect(verifier({ SUPABASE_AUTH_ENABLED: 'true' }).enabled).toBe(true);
  });

  it('accepts a validly signed HS256 token and returns its claims', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    const claims = await v.verify(sign({ sub: 'auth-uuid-1', email: 'a@b.co', exp: future() }));
    expect(claims.sub).toBe('auth-uuid-1');
    expect(claims.email).toBe('a@b.co');
  });

  it('rejects a token signed with a different secret', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    await expect(v.verify(sign({ sub: 'x', exp: future() }, 'wrong-secret'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tampered payload', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    const good = sign({ sub: 'user-1', exp: future() });
    const [h, , s] = good.split('.');
    const forged = `${h}.${b64({ sub: 'admin', exp: future() })}.${s}`;
    await expect(v.verify(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses alg:none so a caller cannot forge an identity', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    const h = b64({ alg: 'none', typ: 'JWT' });
    const p = b64({ sub: 'attacker', exp: future() });
    await expect(v.verify(`${h}.${p}.`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses an asymmetric alg even with a matching HMAC', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    // header says RS256 but the signature is HMAC — must not be accepted.
    const token = sign({ sub: 'x', exp: future() }, SECRET, 'RS256');
    await expect(v.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    await expect(v.verify(sign({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 10 }))).rejects.toThrow(/expired/i);
  });

  it('rejects a token with no subject', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    await expect(v.verify(sign({ exp: future() }))).rejects.toThrow(/no subject/i);
  });

  it('rejects malformed input', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    for (const bad of ['', 'a.b', 'a.b.c.d', 'not..']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(v.verify(bad)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('fails loudly when the secret is missing rather than accepting anything', async () => {
    const v = verifier({});
    await expect(v.verify(sign({ sub: 'x', exp: future() }))).rejects.toThrow(/SUPABASE_JWT_SECRET/);
  });

  it('does not treat tenant as an authorization source (kept app-side)', async () => {
    const v = verifier({ SUPABASE_JWT_SECRET: SECRET });
    // A tenant claim in the token must not become the request's tenant; tenancy is
    // resolved from x-tenant-slug. This asserts the verifier simply passes claims
    // through without treating them as authoritative.
    const claims = await v.verify(sign({ sub: 'u', exp: future(), tenant_id: 'spoofed' }));
    expect(claims.sub).toBe('u');
    expect(Object.keys(claims)).toContain('tenant_id');
  });
});


/*
 * JWKS / asymmetric support.
 *
 * Supabase projects sign with ES256 and publish the key at
 * /auth/v1/.well-known/jwks.json. A locally generated P-256 key lets this be tested
 * without network access or real credentials.
 */
describe('SupabaseTokenVerifier with a JWKS (ES256)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string; kty: string; crv: string };
  const kid = 'test-kid-1';
  const JWKS_URL = 'https://project.supabase.co/auth/v1/.well-known/jwks.json';

  const esVerifier = () => {
    const v = new SupabaseTokenVerifier({
      get: (k: string) =>
        ({
          SUPABASE_AUTH_ENABLED: true,
          SUPABASE_JWKS_URL: JWKS_URL,
        })[k],
    } as never);
    // Seed the cache so no network call is made.
    (v as unknown as { jwksCache: unknown }).jwksCache = {
      keys: [{ ...jwk, kid, alg: 'ES256', use: 'sig' }],
      fetchedAt: Date.now(),
    };
    return v;
  };

  const signEs256 = (claims: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signingInput = `${header}.${payload}`;
    // JOSE uses the raw R||S form; Node signs DER, so convert on the way out.
    const der = cryptoSign('sha256', Buffer.from(signingInput), privateKey);
    const raw = derToRaw(der);
    return `${signingInput}.${raw.toString('base64url')}`;
  };

  it('accepts a valid ES256 token signed by the published key', async () => {
    const claims = await esVerifier().verify(signEs256({ sub: 'auth-uuid-9', exp: future() }));
    expect(claims.sub).toBe('auth-uuid-9');
  });

  it('rejects an ES256 token whose payload was tampered with', async () => {
    const token = signEs256({ sub: 'auth-uuid-9', exp: future() });
    const [h, p, s] = token.split('.') as [string, string, string];
    const forged = `${h}.${b64({ sub: 'admin', exp: future() })}.${s}`;
    await expect(esVerifier().verify(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses an HS256 downgrade even though a shared secret may be configured', async () => {
    const v = new SupabaseTokenVerifier({
      get: (k: string) =>
        ({
          SUPABASE_AUTH_ENABLED: true,
          SUPABASE_JWKS_URL: JWKS_URL,
          SUPABASE_JWT_SECRET: 'also-configured',
        })[k],
    } as never);
    (v as unknown as { jwksCache: unknown }).jwksCache = {
      keys: [{ ...jwk, kid, alg: 'ES256', use: 'sig' }],
      fetchedAt: Date.now(),
    };
    const h = b64({ alg: 'HS256', typ: 'JWT' });
    const p = b64({ sub: 'x', exp: future() });
    const sig = createHmac('sha256', 'also-configured').update(`${h}.${p}`).digest('base64url');
    await expect(v.verify(`${h}.${p}.${sig}`)).rejects.toThrow(/Unsupported token algorithm/);
  });

  it('rejects a token signed by a different EC key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'x', exp: future() })).toString('base64url');
    const input = `${header}.${payload}`;
    const raw = derToRaw(cryptoSign('sha256', Buffer.from(input), other.privateKey));
    await expect(esVerifier().verify(`${input}.${raw.toString('base64url')}`)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired ES256 token', async () => {
    await expect(
      esVerifier().verify(signEs256({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 5 })),
    ).rejects.toThrow(/expired/i);
  });

  it('derives the JWKS URL from SUPABASE_URL when not set explicitly', () => {
    const v = new SupabaseTokenVerifier({
      get: (k: string) => ({ SUPABASE_AUTH_ENABLED: true, SUPABASE_URL: 'https://p.supabase.co' })[k],
    } as never);
    expect((v as unknown as { jwksUrl: string }).jwksUrl).toBe(
      'https://p.supabase.co/auth/v1/.well-known/jwks.json',
    );
  });
});

/** Converts a DER-encoded ECDSA signature to the raw R||S form JWT carries. */
function derToRaw(der: Buffer): Buffer {
  let offset = der[0] === 0x30 ? 2 : 0;
  const readInt = () => {
    let len = der[offset + 1]!;
    let start = offset + 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i += 1) len = len * 256 + der[start + i]!;
      start += n;
    }
    const v = der.subarray(start, start + len);
    offset = start + len;
    return v;
  };
  const r = readInt();
  const s = readInt();
  const strip = (b: Buffer) => (b[0] === 0 ? b.subarray(1) : b);
  const pad = (b: Buffer, size: number) => {
    const v = strip(b);
    return v.length >= size ? v : Buffer.concat([Buffer.alloc(size - v.length), v]);
  };
  return Buffer.concat([pad(r, 32), pad(s, 32)]);
}
