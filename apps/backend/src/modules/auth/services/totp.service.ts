import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { toDataURL } from 'qrcode';
import { DrizzleService } from '../../../database/drizzle.service';
import { twoFactorSecrets } from '../../../database/schema/auth';
import { users } from '../../../database/schema/users';
import { eq } from 'drizzle-orm';

/**
 * otplib v13's functional API is split:
 *   - `verify(opts)`     -> **Promise** resolving to `{ valid, delta, epoch, timeStep }`
 *   - `verifySync(opts)` -> the same object, synchronously
 *
 * BOTH return an OBJECT, never a boolean. The original code did
 * `return otplib.verify({ token, secret })` from a sync method — that returned a truthy
 * **Promise**, so every `if (!valid)` guard passed and 2FA accepted any code.
 *
 * We use `verifySync` so `verifyToken` can stay synchronous (its three call sites in
 * auth.controller.ts are all synchronous).
 */
type OtplibVerifyResult = boolean | { valid?: boolean };

let otplib: {
  generateSecret(): string;
  generateURI(opts: { issuer: string; label: string; secret: string }): string;
  verifySync?(opts: { token: string; secret: string }): OtplibVerifyResult;
  verify?(opts: { token: string; secret: string }): OtplibVerifyResult;
};
/** RFC 4648 base32 alphabet — what TOTP secrets and authenticator apps expect. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomBase32(length = 32): string {
  const bytes = randomBytes(length);
  let out = '';
  // Iterated rather than indexed: `noUncheckedIndexedAccess` makes both `bytes[i]` and
  // `ALPHABET[i]` possibly-undefined, and this avoids reaching for a non-null assertion.
  for (const byte of bytes) out += BASE32_ALPHABET.charAt(byte % 32);
  return out;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  otplib = require('otplib/functional');
} catch (e) {
  // Fail CLOSED: verification always denies, so 2FA can never be enabled or completed
  // while the real library is missing. The dangerous direction is *accepting* a code,
  // and that is exactly what this prevents.
  //
  // `generateSecret` must still be random. It used to be a hardcoded literal, so every
  // user would have shared one secret. `enable2fa` cannot succeed today because
  // `verifySync` denies, so no shared secret was ever persisted; but a secret minted
  // while degraded and stored by a later healthy build would be a live backdoor for
  // anyone who knows that literal. (Deliberately not spelled out here — a test asserts
  // the constant is absent from this file, and naming it would defeat that check.)
  new Logger('TotpService').error(
    `otplib/functional failed to load (${(e as Error)?.message}) — 2FA verification is DISABLED`,
  );
  otplib = {
    generateSecret: () => randomBase32(),
    generateURI: ({ issuer, label, secret }: { issuer: string; label: string; secret: string }) =>
      `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`,
    verifySync: () => false,
  };
}

/**
 * Normalise whatever otplib hands back into a real boolean.
 * Accepts `true`/`false` and `{ valid: boolean }`.
 * A Promise, `{}`, `undefined`, or `{ valid: undefined }` is a FAIL — never truthy-by-accident.
 */
function normalizeVerifyResult(result: OtplibVerifyResult | Promise<unknown>): boolean {
  if (typeof result === 'boolean') return result;
  if (result && typeof result === 'object' && typeof (result as { valid?: unknown }).valid === 'boolean') {
    return (result as { valid: boolean }).valid;
  }
  return false;
}

@Injectable()
export class TotpService {
  constructor(private drizzle: DrizzleService) {}

  generateSecret(userEmail: string): { secret: string; otpauthUrl: string } {
    const secret = otplib.generateSecret();
    const otpauthUrl = otplib.generateURI({ issuer: 'TITANS of Manufacturing', label: userEmail, secret });
    return { secret, otpauthUrl };
  }

  async generateQrCode(otpauthUrl: string): Promise<string> {
    return toDataURL(otpauthUrl);
  }

  /**
   * Verify a 6-digit TOTP. Returns a REAL boolean.
   *
   * Uses the synchronous otplib API so a Promise can never leak out and be treated as
   * truthy. `{ valid: false }` and Promises both normalise to `false`.
   */
  verifyToken(token: string, secret: string): boolean {
    if (!token || !secret) return false;
    const normalizedToken = String(token).replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(normalizedToken)) return false;
    try {
      const opts = { token: normalizedToken, secret };
      const result = typeof otplib.verifySync === 'function'
        ? otplib.verifySync(opts)
        : otplib.verify?.(opts);
      // Guard against a Promise ever being returned by an async variant.
      if (result instanceof Promise) return false;
      return normalizeVerifyResult(result as OtplibVerifyResult);
    } catch {
      return false;
    }
  }

  async enable2fa(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    // Upsert so re-running setup after a partial enable doesn't hit the unique constraint
    await this.drizzle.db
      .insert(twoFactorSecrets)
      .values({ userId, secret, backupCodes, enabledAt: new Date() })
      .onConflictDoUpdate({
        target: twoFactorSecrets.userId,
        set: { secret, backupCodes, enabledAt: new Date(), updatedAt: new Date() },
      });
    await this.drizzle.db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, userId));
  }

  async disable2fa(userId: string): Promise<void> {
    await this.drizzle.db
      .delete(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId));
    await this.drizzle.db
      .update(users)
      .set({ twoFactorEnabled: false })
      .where(eq(users.id, userId));
  }

  async getSecret(userId: string): Promise<string | null> {
    const record = await this.drizzle.db.query.twoFactorSecrets.findFirst({
      where: eq(twoFactorSecrets.userId, userId),
    });
    return record?.secret || null;
  }

  async getBackupCodes(userId: string): Promise<string[] | null> {
    const record = await this.drizzle.db.query.twoFactorSecrets.findFirst({
      where: eq(twoFactorSecrets.userId, userId),
    });
    return (record?.backupCodes as string[]) || null;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const record = await this.drizzle.db.query.twoFactorSecrets.findFirst({
      where: eq(twoFactorSecrets.userId, userId),
    });
    if (!record) return false;

    const codes = record.backupCodes as string[];
    const index = codes.indexOf(code.toUpperCase());
    if (index === -1) return false;

    codes.splice(index, 1);
    await this.drizzle.db
      .update(twoFactorSecrets)
      .set({ backupCodes: codes })
      .where(eq(twoFactorSecrets.userId, userId));

    return true;
  }
}
