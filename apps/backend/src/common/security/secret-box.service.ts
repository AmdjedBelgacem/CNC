import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const KEY_VERSION = '1';
const IV_BYTES = 12;

export class SecretBoxUnavailableError extends Error {
  constructor() {
    super('Secret encryption is not configured');
    this.name = 'SecretBoxUnavailableError';
  }
}

/**
 * Envelope encryption for third-party credentials: payment gateway secret keys
 * and Google OAuth refresh tokens.
 *
 * Properties that matter here, and why:
 *
 *  - AES-256-GCM, so a tampered ciphertext fails to decrypt rather than
 *    decrypting to attacker-chosen plaintext.
 *  - The tenant (or service) and the provider name are bound in as AAD, so a
 *    ciphertext copied from one tenant's row cannot be replayed into another's
 *    row, and a key rotated from test to live cannot be replayed as the other.
 *  - `configured` is false when no master key is set, and callers must treat that
 *    as "cannot proceed" rather than "store it in the clear". A missing key is a
 *    deployment error, not a reason to weaken the encryption.
 */
@Injectable()
export class SecretBoxService {
  private readonly key: Buffer | null;
  private readonly status: 'ready' | 'missing' | 'invalid';

  constructor(config: ConfigService) {
    const configured = [
      config.get('SECRETS_ENCRYPTION_KEY'),
      config.get('AI_ASSISTANT_ENCRYPTION_KEY'),
      config.get('AI_SECRET_ENCRYPTION_KEY'),
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;
    const parsed = this.parseKey(configured);
    this.key = parsed.key;
    this.status = parsed.status;
  }

  get configured(): boolean {
    return this.status === 'ready';
  }

  get state(): 'ready' | 'missing' | 'invalid' {
    return this.status;
  }

  encrypt(plaintext: string, scope: string, provider: string): string {
    this.assertAvailable();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key!, iv);
    cipher.setAAD(Buffer.from(this.aad(scope, provider), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      ENVELOPE_VERSION,
      KEY_VERSION,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join(':');
  }

  decrypt(envelope: string, scope: string, provider: string): string {
    this.assertAvailable();
    const parts = envelope.split(':');
    if (parts.length !== 5 || parts[0] !== ENVELOPE_VERSION || parts[1] !== KEY_VERSION) {
      throw new Error('Invalid secret envelope');
    }
    try {
      const [, , ivPart, dataPart, tagPart] = parts;
      const decipher = createDecipheriv('aes-256-gcm', this.key!, Buffer.from(ivPart!, 'base64url'));
      decipher.setAAD(Buffer.from(this.aad(scope, provider), 'utf8'));
      decipher.setAuthTag(Buffer.from(tagPart!, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataPart!, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Wrong scope, wrong provider, or a tampered blob all land here and are
      // deliberately indistinguishable.
      throw new Error('Unable to decrypt secret');
    }
  }

  /** Encrypt, but surface the failure as a 503 rather than an opaque 500. */
  encryptOrThrow(plaintext: string, scope: string, provider: string): string {
    try {
      return this.encrypt(plaintext, scope, provider);
    } catch (error) {
      if (error instanceof SecretBoxUnavailableError) {
        throw new ServiceUnavailableException(
          'Secret storage is not configured on this server (SECRETS_ENCRYPTION_KEY).',
        );
      }
      throw error;
    }
  }

  private aad(scope: string, provider: string): string {
    return `${scope}|${provider}`;
  }

  private assertAvailable(): void {
    if (!this.key) throw new SecretBoxUnavailableError();
  }

  private parseKey(raw: string | undefined): { key: Buffer | null; status: 'ready' | 'missing' | 'invalid' } {
    if (!raw || !raw.trim()) return { key: null, status: 'missing' };
    const value = raw.trim();
    let key: Buffer;
    if (/^[0-9a-f]{64}$/i.test(value)) {
      key = Buffer.from(value, 'hex');
    } else {
      key = Buffer.from(value, 'base64');
    }
    if (key.length !== 32) return { key: null, status: 'invalid' };
    return { key, status: 'ready' };
  }
}
