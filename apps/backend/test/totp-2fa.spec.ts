import { describe, it, expect } from 'vitest';
import { TotpService } from '../src/modules/auth/services/totp.service';

/**
 * The worst finding in the audit: 2FA accepted ANY code.
 *
 * Root cause: otplib v13's functional API returns an OBJECT, not a boolean —
 * `verify(opts)` resolves to `{ valid, delta, epoch, timeStep }`. The old code
 * treated that truthy object as a boolean, so `000000` passed. The obvious
 * "fix" (read `.valid` off the return of `verify`) is also wrong, because
 * `verify` is async and `.valid` on a Promise is `undefined` — which would have
 * made the happy path fail forever. Both shapes are pinned below.
 */

// otplib's functional entry point (same module TotpService loads).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const otplib = require('otplib/functional') as {
  generateSecret(): string;
  generateSync(opts: { secret: string }): string;
  verifySync(opts: { token: string; secret: string }): unknown;
  verify(opts: { token: string; secret: string }): unknown;
};

describe('TotpService.verifyToken — 2FA bypass regression', () => {
  const totp = new TotpService({} as never);
  const { secret, otpauthUrl } = totp.generateSecret('learner@example.com');
  const code = otplib.generateSync({ secret });

  it('generates a secret long enough for otplib (>= 16 bytes)', () => {
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('returns an otpauth URL an authenticator app can consume', () => {
    expect(otpauthUrl).toContain('otpauth://totp/');
    expect(otpauthUrl).toContain(encodeURIComponent('learner@example.com'));
    expect(otpauthUrl).toContain(secret);
  });

  it('rejects 000000 — the original bypass', () => {
    expect(totp.verifyToken('000000', secret)).toBe(false);
  });

  it('rejects other well-formed but wrong codes', () => {
    expect(totp.verifyToken('111111', secret)).toBe(false);
    expect(totp.verifyToken('999999', secret)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    expect(totp.verifyToken('', secret)).toBe(false);
    expect(totp.verifyToken('abcdef', secret)).toBe(false);
    expect(totp.verifyToken('12345', secret)).toBe(false);
    expect(totp.verifyToken('1234567890', secret)).toBe(false);
    expect(totp.verifyToken(undefined as unknown as string, secret)).toBe(false);
    expect(totp.verifyToken('123456', '')).toBe(false);
    expect(totp.verifyToken('123456', 'not-base32-!!!')).toBe(false);
  });

  it('accepts a real code generated from the same secret', () => {
    expect(code).toMatch(/^\d{6}$/);
    expect(totp.verifyToken(code, secret)).toBe(true);
  });

  it('tolerates whitespace in user-entered codes', () => {
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(totp.verifyToken(spaced, secret)).toBe(true);
  });

  it('rejects a code generated from a DIFFERENT secret', () => {
    const other = otplib.generateSecret();
    expect(totp.verifyToken(code, other)).toBe(false);
  });

  it('returns a strict boolean — never the otplib result object or a Promise', () => {
    const ok = totp.verifyToken(code, secret);
    const bad = totp.verifyToken('000000', secret);
    expect(typeof ok).toBe('boolean');
    expect(typeof bad).toBe('boolean');
    expect(ok).toBe(true);
    expect(bad).toBe(false);
  });
});

describe('otplib v13 shape contract (why the naive fix is also wrong)', () => {
  const secret = otplib.generateSecret();

  it('verifySync returns an OBJECT with a `valid` flag, not a boolean', () => {
    const result = otplib.verifySync({ token: '000000', secret });
    expect(result).toBeTypeOf('object');
    expect(result).not.toBeTypeOf('boolean');
    expect(result).toHaveProperty('valid');
    expect((result as { valid: boolean }).valid).toBe(false);
  });

  it('verify returns a PROMISE — reading `.valid` off it yields undefined', async () => {
    const maybe = otplib.verify({ token: '000000', secret });
    expect(maybe).toBeInstanceOf(Promise);
    expect((maybe as { valid?: unknown }).valid).toBeUndefined();
    const awaited = (await maybe) as { valid: boolean };
    expect(awaited.valid).toBe(false);
  });
});
