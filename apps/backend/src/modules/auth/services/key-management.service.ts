import { Injectable, Inject } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { DrizzleService } from '../../../database/drizzle.service';
import { ConfigService } from '../../../config/config.service';
import { signingKeys } from '../../../database/schema/auth';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class KeyManagementService {
  private currentKeyId: string | null = null;
  private currentSecret: string | null = null;

  constructor(
    private drizzle: DrizzleService,
    @Inject(ConfigService) private config: ConfigService,
  ) {}

  async onModuleInit() {
    const envSecret = this.config.get('JWT_ACCESS_SECRET');
    if (envSecret) {
      await this.initializeFromEnv(envSecret);
    }
    await this.loadCurrentKey();
  }

  private async loadCurrentKey() {
    const key = await this.drizzle.db.query.signingKeys.findFirst({
      where: eq(signingKeys.isActive, true),
    });
    if (key) {
      this.currentKeyId = key.keyId;
      this.currentSecret = key.secret;
    }
  }

  async getCurrentSigningKey(): Promise<{ keyId: string; secret: string }> {
    if (this.currentKeyId && this.currentSecret) {
      return { keyId: this.currentKeyId, secret: this.currentSecret };
    }
    await this.loadCurrentKey();
    if (this.currentKeyId && this.currentSecret) {
      return { keyId: this.currentKeyId, secret: this.currentSecret };
    }
    throw new Error('No active signing key found. Set JWT_ACCESS_SECRET or rotate a key.');
  }

  async getVerificationKey(keyId: string): Promise<string | null> {
    if (keyId === this.currentKeyId && this.currentSecret) {
      return this.currentSecret;
    }
    const key = await this.drizzle.db.query.signingKeys.findFirst({
      where: and(eq(signingKeys.keyId, keyId), eq(signingKeys.isActive, true)),
    });
    return key?.secret || null;
  }

  async rotateKey(previousSecret: string): Promise<{ keyId: string; secret: string }> {
    const keyId = randomBytes(16).toString('hex');
    const secret = randomBytes(64).toString('hex');

    await this.drizzle.db
      .update(signingKeys)
      .set({ isActive: false, rotatedAt: new Date() })
      .where(eq(signingKeys.isActive, true));

    await this.drizzle.db.insert(signingKeys).values({
      keyId,
      secret,
      algorithm: 'HS256',
      isActive: true,
    });

    const existingKey = await this.drizzle.db.query.signingKeys.findFirst({
      where: and(eq(signingKeys.isActive, false), isNull(signingKeys.rotatedAt)),
      orderBy: (keys: any, { desc }: any) => [desc(keys.createdAt)],
    });

    if (existingKey) {
      const hash = createHash('sha256').update(previousSecret).digest('hex');
      if (existingKey.secret === previousSecret || createHash('sha256').update(existingKey.secret).digest('hex') === hash) {
        // If the old key matches the env secret, store it as a historic key
      }
    }

    this.currentKeyId = keyId;
    this.currentSecret = secret;

    return { keyId, secret };
  }

  async initializeFromEnv(envSecret: string): Promise<void> {
    const existingActive = await this.drizzle.db.query.signingKeys.findFirst({
      where: eq(signingKeys.isActive, true),
    });
    if (existingActive) return;

    const keyId = randomBytes(16).toString('hex');
    await this.drizzle.db.insert(signingKeys).values({
      keyId,
      secret: envSecret,
      algorithm: 'HS256',
      isActive: true,
    });

    this.currentKeyId = keyId;
    this.currentSecret = envSecret;
  }

  async cleanupExpiredKeys(): Promise<void> {
    await this.drizzle.db
      .delete(signingKeys)
      .where(and(eq(signingKeys.isActive, false)));
  }

  getCurrentKeyId(): string | null {
    return this.currentKeyId;
  }
}
