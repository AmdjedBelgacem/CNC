import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, createVerify, createHmac } from 'node:crypto';
import { ConfigService } from '../../config/config.service';

/**
 * Supabase (GoTrue) access-token claims.
 *
 * `sub` is the auth.users UUID. Tenancy is deliberately NOT taken from claims: the
 * tenants table, `x-tenant-slug` resolution and per-tenant RBAC stay in this
 * application, so a claim-based tenant would go stale on tenant switch and create a
 * second source of truth for authorization.
 */
export interface SupabaseClaims {
  sub: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
  session_id?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  crv?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  [k: string]: unknown;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const JWKS_TTL_MS = 5 * 60 * 1000;

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('claim segment is not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Verifies Supabase-issued access tokens.
 *
 * Modern Supabase projects sign asymmetrically (ES256/RS256) and publish the public
 * key at `<url>/auth/v1/.well-known/jwks.json`. Older projects sign with HS256 using a
 * shared JWT secret. Both are supported, but they are never mixed: when a JWKS URL is
 * configured it is authoritative, so an attacker cannot downgrade a token to HS256 and
 * have it checked against the public key material.
 *
 * The algorithm is always taken from the verified key, never from the token header
 * alone, which is what prevents algorithm-substitution and `alg: none` forgeries.
 */
/**
 * Converts a raw JOSE ECDSA signature (R||S, each padded to the curve size) into the
 * ASN.1 DER form Node's verifier expects.
 *
 * JWT always carries the raw form, so a 64-byte P-256 signature is exactly
 * r(32) || s(32). DER requires each integer to be minimally encoded with a leading
 * 0x00 when the high bit is set, which is what makes naive concatenation fail.
 */
function rawEcdsaToDer(signature: Buffer): Buffer {
  const half = signature.length / 2;
  const encodeInteger = (bytes: Buffer): Buffer => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i += 1;
    let value = bytes.subarray(i);
    if (value[0]! & 0x80) value = Buffer.concat([Buffer.from([0x00]), value]);
    return Buffer.concat([Buffer.from([0x02, value.length]), value]);
  };
  const r = encodeInteger(signature.subarray(0, half));
  const s = encodeInteger(signature.subarray(half));
  return Buffer.concat([Buffer.from([0x30, r.length + s.length]), r, s]);
}

const P256_RAW_LEN = 64; // r(32) + s(32)
const P384_RAW_LEN = 96;

@Injectable()
export class SupabaseTokenVerifier {
  private jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
  private inflight: Promise<Jwk[]> | null = null;

  constructor(@Inject(ConfigService) private config: ConfigService) {}

  get enabled(): boolean {
    // The schema transforms 'true' to a boolean, but tolerate the raw string too so a
    // partially-applied config cannot silently read as disabled.
    const value: unknown = this.config.get('SUPABASE_AUTH_ENABLED');
    return value === true || value === 'true';
  }

  private get jwksUrl(): string | undefined {
    const explicit = this.config.get('SUPABASE_JWKS_URL');
    if (explicit) return String(explicit);
    const base = this.config.get('SUPABASE_URL');
    // Derive it so only SUPABASE_URL has to be set.
    return base ? `${String(base).replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json` : undefined;
  }

  private async getJwks(): Promise<Jwk[]> {
    const now = Date.now();
    if (this.jwksCache && now - this.jwksCache.fetchedAt < JWKS_TTL_MS) {
      return this.jwksCache.keys;
    }
    // Collapse concurrent refreshes so a burst of requests fetches once.
    if (!this.inflight) {
      this.inflight = (async () => {
        const url = this.jwksUrl;
        if (!url) throw new UnauthorizedException('Supabase JWKS URL is not configured');
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) {
          throw new UnauthorizedException(`Could not load Supabase signing keys (HTTP ${res.status})`);
        }
        const body = (await res.json()) as { keys?: Jwk[] };
        const keys = (body.keys ?? []).filter((k) => k.use === undefined || k.use === 'sig');
        this.jwksCache = { keys, fetchedAt: Date.now() };
        return keys;
      })().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async verifyAsymmetric(header: Record<string, unknown>, signed: string, signature: Buffer) {
    const keys = await this.getJwks();
    const kid = typeof header.kid === 'string' ? header.kid : undefined;

    // Prefer an exact kid match; fall back to the single key when there is only one.
    const candidates = kid ? keys.filter((k) => k.kid === kid) : keys;
    if (candidates.length === 0) {
      // Unknown kid usually means a rotated key. Drop the cache and retry once.
      this.jwksCache = null;
      const refreshed = await this.getJwks();
      const retry = kid ? refreshed.filter((k) => k.kid === kid) : refreshed;
      if (retry.length === 0) throw new UnauthorizedException('Unknown token signing key');
      return this.tryKeys(retry, signed, signature);
    }
    return this.tryKeys(candidates, signed, signature);
  }

  private tryKeys(keys: Jwk[], signed: string, signature: Buffer): boolean {
    for (const jwk of keys) {
      // Only asymmetric algorithms from the published set. Never HMAC here.
      const alg = jwk.alg ?? (jwk.kty === 'EC' ? 'ES256' : jwk.kty === 'RSA' ? 'RS256' : undefined);
      if (!alg || !/^(ES|RS|PS)/.test(alg)) continue;

      const isEcdsa = /^ES/.test(alg);
      // JWT carries a raw R||S ECDSA signature; Node's verifier wants ASN.1 DER.
      // Convert when the length is exactly the raw form for the curve, otherwise pass
      // the bytes through unchanged (RSA, or a provider already emitting DER).
      const der =
        isEcdsa && (signature.length === P256_RAW_LEN || signature.length === P384_RAW_LEN)
          ? rawEcdsaToDer(signature)
          : signature;

      try {
        const key = createPublicKey({ key: jwk as never, format: 'jwk' });
        const verifier = createVerify(isEcdsa ? 'sha256' : alg);
        verifier.update(signed);
        verifier.end();
        // Call verify() as a method on `verifier`. Extracting it (`const check =
        // verifier.verify`) detaches `this`, and Node's implementation dereferences
        // `this[kHandle]`, which throws "Cannot read properties of undefined".
        // The typings only expose the string-signature overload, hence the cast.
        type VerifyWithBuffer = (this: unknown, k: unknown, s: Buffer, format: string) => boolean;
        const ok = (verifier.verify as unknown as VerifyWithBuffer).call(verifier, key, der, 'der');
        if (ok) return true;
      } catch {
        // Unusable key material, or a signature encoding Node rejected. Try the next.
      }
    }
    return false;
  }

  async verify(token: string): Promise<SupabaseClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Malformed token');
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
    if (![headerB64, payloadB64, signatureB64].every((p) => BASE64URL.test(p))) {
      throw new UnauthorizedException('Malformed token');
    }

    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = decodeSegment(headerB64);
      payload = decodeSegment(payloadB64);
    } catch {
      throw new UnauthorizedException('Malformed token');
    }

    const alg = header.alg;
    if (typeof alg !== 'string') throw new UnauthorizedException('Token has no algorithm');
    const signed = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    if (this.jwksUrl) {
      // Asymmetric project: HS256 must be refused outright, otherwise a caller could
      // present an HMAC token and have it checked against public key material.
      if (!/^(ES|RS|PS)/.test(alg)) {
        throw new UnauthorizedException(`Unsupported token algorithm for this project: ${alg}`);
      }
      const ok = await this.verifyAsymmetric(header, signed, signature);
      if (!ok) throw new UnauthorizedException('Invalid token signature');
    } else {
      const secret = this.config.get('SUPABASE_JWT_SECRET');
      if (!secret) {
        throw new UnauthorizedException(
          'Supabase auth is enabled but neither SUPABASE_JWKS_URL nor SUPABASE_JWT_SECRET is configured',
        );
      }
      if (alg !== 'HS256') {
        throw new UnauthorizedException(`Unsupported token algorithm: ${alg}`);
      }
      const expected = createHmac('sha256', secret).update(signed).digest();
      if (signature.length !== expected.length || !signature.equals(expected)) {
        throw new UnauthorizedException('Invalid token signature');
      }
    }

    const claims = payload as unknown as SupabaseClaims;
    if (!claims.sub) throw new UnauthorizedException('Token has no subject');
    if (claims.exp !== undefined && claims.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
    return claims;
  }
}