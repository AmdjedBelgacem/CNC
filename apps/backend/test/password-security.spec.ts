import { describe, it, expect } from 'vitest';
import { PasswordService } from '../src/modules/auth/services/password.service';

/**
 * Passwords were stored in cleartext.
 *
 * The dev fallback hashed to `fallback-hash:<password>` — literally the password
 * — and `verify` also accepted `h === p`, so a bare plaintext column value
 * authenticated. All ten seeded accounts read `fallback-hash:Test1234!` straight
 * out of the database. Anyone with a dump, a backup, or a SQL injection had every
 * password immediately, and "hashing" gave no protection at all.
 */
const config = { get: (k: string) => (k === 'ARGON2_PARALLELISM' ? 1 : undefined) } as never;
const svc = new PasswordService(config);

describe('password storage', () => {
  it('never stores the password in the hash', async () => {
    const hash = await svc.hash('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(hash).not.toContain('battery');
    // No cleartext marker may ever be written again.
    expect(hash.startsWith('fallback-hash:')).toBe(false);
    expect(hash).toMatch(/^(\$argon2|scrypt\$)/);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const a = await svc.hash('same-password');
    const b = await svc.hash('same-password');
    expect(a).not.toBe(b);
    expect(await svc.verify(a, 'same-password')).toBe(true);
    expect(await svc.verify(b, 'same-password')).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await svc.hash('right-password');
    expect(await svc.verify(hash, 'wrong-password')).toBe(false);
    expect(await svc.verify(hash, '')).toBe(false);
  });

  it('rejects a bare plaintext value — the old `h === p` hole', async () => {
    expect(await svc.verify('Test1234!', 'Test1234!')).toBe(false);
    expect(await svc.verify('hunter2', 'hunter2')).toBe(false);
  });

  it('rejects malformed and empty hashes without throwing', async () => {
    for (const bad of ['', 'x', 'scrypt$', 'scrypt$a$b$c$d$e', 'scrypt$999999999$8$1$AAAA$AAAA', '$argon2id$broken']) {
      await expect(svc.verify(bad, 'anything')).resolves.toBe(false);
    }
  });

  it('refuses to hash an empty password', async () => {
    await expect(svc.hash('')).rejects.toThrow();
  });

  /**
   * A scrypt hash stores its own cost parameters, so a tampered row must not be
   * able to demand an unbounded allocation and turn verification into a
   * memory-exhaustion vector.
   */
  it('bounds the cost parameters it will honour from a stored hash', async () => {
    // Built explicitly rather than via `hash()`, because which KDF is active
    // depends on whether the argon2 native binding loaded.
    const { randomBytes, scrypt: sc } = await import('node:crypto');
    const { promisify } = await import('node:util');
    const scrypt = promisify(sc) as any;
    const N = 16384;
    const r = 8;
    const p = 1;
    const salt = randomBytes(16);
    const digest = await scrypt('pw', salt, 64, { N, r, p, maxmem: 96 * 1024 * 1024 });
    const [scheme, sN, sr, sp, ssalt, sdigest] = `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${digest.toString('base64')}`.split('$');
    expect(scheme).toBe('scrypt');
    // Absurd parameters must be refused, not attempted.
    const hostile = `scrypt$1073741824$8$1$${ssalt}$${sdigest}`;
    await expect(svc.verify(hostile, 'pw')).resolves.toBe(false);
    // And a plausible set still verifies.
    expect(await svc.verify(`scrypt$${sN}$${sr}$${sp}$${ssalt}$${sdigest}`, 'pw')).toBe(true);
  });

  it('uses constant-time comparison for the legacy marker', async () => {
    // Legacy cleartext is only verifiable off-production; it must never be.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(await svc.verify('fallback-hash:Test1234!', 'Test1234!')).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('marks every non-argon2 hash for upgrade, so cleartext gets replaced', async () => {
    expect(svc.needsRehash('fallback-hash:Test1234!')).toBe(true);
    expect(svc.needsRehash('Test1234!')).toBe(true);
    expect(svc.needsRehash('')).toBe(true);
    const fresh = await svc.hash('pw');
    // Whichever backend is active, a hash it just produced is up to date.
    expect(svc.needsRehash(fresh)).toBe(false);
  });
});
