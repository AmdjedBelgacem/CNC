import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const KEY_VERSION = '1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class AiEncryptionUnavailableError extends Error {
  constructor() {
    super('AI encryption is unavailable');
    this.name = 'AiEncryptionUnavailableError';
  }
}

@Injectable()
export class AiSecretService {
  private readonly encryptionKey: Buffer | null;
  private readonly keyState: 'ready' | 'missing' | 'invalid';

  constructor(config: ConfigService) {
    const configured = [config.get('AI_ASSISTANT_ENCRYPTION_KEY'), config.get('AI_SECRET_ENCRYPTION_KEY')]
      .find((value) => typeof value === 'string' && value.trim().length > 0);
    const parsed = this.parseKey(configured);
    this.encryptionKey = parsed.key;
    this.keyState = parsed.state;
  }

  get configured(): boolean {
    return this.keyState === 'ready';
  }

  get state(): 'ready' | 'missing' | 'invalid' {
    return this.keyState;
  }

  encrypt(plaintext: string, tenantId: string, provider: string): string {
    this.assertAvailable();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey!, iv);
    cipher.setAAD(Buffer.from(this.aad(tenantId, provider), 'utf8'));
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

  decrypt(envelope: string, tenantId: string, provider: string): string {
    this.assertAvailable();
    const parts = envelope.split(':');
    if (parts.length !== 5 || parts[0] !== ENVELOPE_VERSION || parts[1] !== KEY_VERSION) {
      throw new Error('Invalid AI secret envelope');
    }
    try {
      const iv = Buffer.from(parts[2]!, 'base64url');
      const ciphertext = Buffer.from(parts[3]!, 'base64url');
      const tag = Buffer.from(parts[4]!, 'base64url');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error('Invalid AI secret envelope');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey!, iv);
      decipher.setAAD(Buffer.from(this.aad(tenantId, provider), 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Unable to decrypt AI secret');
    }
  }

  private assertAvailable(): void {
    if (!this.configured) throw new AiEncryptionUnavailableError();
  }

  private aad(tenantId: string, provider: string): string {
    return `${ENVELOPE_VERSION}|${tenantId}|${provider}`;
  }

  private parseKey(value: string | undefined): { key: Buffer | null; state: 'ready' | 'missing' | 'invalid' } {
    if (!value || !value.trim()) return { key: null, state: 'missing' };
    const raw = value.trim();
    let key: Buffer | null = null;
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      key = Buffer.from(raw, 'hex');
    } else if (/^[A-Za-z0-9+/=_-]+$/.test(raw)) {
      try {
        const decoded = Buffer.from(raw, 'base64');
        if (decoded.length === 32) key = decoded;
        if (!key && /^[A-Za-z0-9_-]+$/.test(raw)) {
          const base64UrlDecoded = Buffer.from(raw, 'base64url');
          if (base64UrlDecoded.length === 32) key = base64UrlDecoded;
        }
      } catch {
        key = null;
      }
    }
    if (!key && Buffer.byteLength(raw, 'utf8') === 32) key = Buffer.from(raw, 'utf8');
    if (!key || key.length !== 32) return { key: null, state: 'invalid' };
    return { key, state: 'ready' };
  }
}
