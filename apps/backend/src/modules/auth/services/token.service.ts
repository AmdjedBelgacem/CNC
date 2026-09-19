import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { DrizzleService } from '../../../database/drizzle.service';
import { refreshTokens, userSessions, impersonationSessions } from '../../../database/schema/auth';
import { oauthStates } from '../../../database/schema/oauth-states';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { ConfigService } from '../../../config/config.service';
import { RedisService } from './redis.service';

/**
 * How long after a refresh token is rotated a second presentation of that same
 * token is treated as a benign race rather than theft.
 *
 * Rotation happens on every refresh, and a browser can legitimately present the
 * pre-rotation cookie twice in quick succession — a double navigation, a reload
 * fired while the previous refresh is still in flight, or two tabs waking up
 * together — because the `Set-Cookie` carrying the replacement has not landed yet.
 * Without this window those races were indistinguishable from a replay, and
 * `handleReusedToken` responded by revoking the user's ENTIRE token family and all
 * their sessions: a reproducible, account-wide logout from nothing more than two
 * fast page loads.
 *
 * Inside the window the request is still denied (so a replayed token never yields a
 * session) but the family is left intact, so the legitimate session survives.
 * Outside it, aggressive family revocation is unchanged. Set to 0 to restore the
 * previous always-revoke behaviour.
 */
const REFRESH_REUSE_GRACE_MS = Number(process.env.REFRESH_REUSE_GRACE_MS ?? 10_000);

@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private drizzle: DrizzleService,
    private config: ConfigService,
    private redisService: RedisService,
  ) {}

  generateAccessToken(payload: {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    impersonating?: boolean;
    impersonatedBy?: string;
  }): string {
    const jti = randomUUID();
    return this.jwt.sign({ ...payload, type: 'access', jti });
  }

  parseExpiryToMs(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry ?? '');
    if (!match?.[1] || !match?.[2]) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * (multipliers[match[2]] || 60 * 1000);
  }

  getAccessTokenExpiryMs(): number {
    return this.parseExpiryToMs(this.config.get('JWT_ACCESS_EXPIRY'));
  }

  async denylistAccessToken(jti: string, expiresInMs?: number): Promise<void> {
    const ttl = expiresInMs ? Math.ceil(expiresInMs / 1000) : 900; // 15m default
    await this.redisService.setex(`jti:${jti}`, ttl, 'revoked');
  }

  async isAccessTokenDenylisted(jti: string): Promise<boolean> {
    const val = await this.redisService.get(`jti:${jti}`);
    return !!val;
  }

  async generateRefreshToken(
    userId: string,
    deviceInfo?: string,
    ip?: string,
    userAgent?: string,
    rememberDevice = false,
  ): Promise<string> {
    const tokenBytes = randomBytes(64);
    const rawToken = tokenBytes.toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiryStr = rememberDevice
      ? this.config.get('JWT_REFRESH_EXPIRY_REMEMBER')
      : this.config.get('JWT_REFRESH_EXPIRY');
    const expiresAt = new Date(Date.now() + this.parseExpiryToMs(expiryStr));

    await this.drizzle.db.insert(refreshTokens).values({
      userId, tokenHash,
      deviceInfo: deviceInfo || null, ip: ip || null, userAgent: userAgent || null,
      expiresAt,
    });

    await this.drizzle.db.insert(userSessions).values({
      userId, tokenHash,
      deviceInfo: deviceInfo || null, ip: ip || null, userAgent: userAgent || null,
      expiresAt,
    });

    return rawToken;
  }

  async verifyAndRotateRefreshToken(
    rawToken: string,
    deviceInfo?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: string; tenantId: string };
  }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const existing = await this.drizzle.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
      with: { user: true },
    });

    if (!existing || !existing.user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (existing.isRevoked) {
      // Deny either way, but only treat it as theft once the token is older than the
      // race window — otherwise two page loads in quick succession log the user out
      // of every device. See REFRESH_REUSE_GRACE_MS.
      const rotatedAt = existing.revokedAt ? new Date(existing.revokedAt).getTime() : 0;
      const withinGrace = rotatedAt > 0 && Date.now() - rotatedAt < REFRESH_REUSE_GRACE_MS;
      if (!withinGrace) {
        await this.handleReusedToken(existing.userId, existing.id);
      }
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (existing.user.accountStatus === 'deleted' || existing.user.accountStatus === 'suspended') {
      throw new UnauthorizedException('Account is not accessible');
    }

    if (new Date() > new Date(existing.expiresAt)) {
      await this.revokeRefreshToken(rawToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Atomic claim. Reading `isRevoked` and then writing it is a TOCTOU window: two
    // concurrent refreshes both observe `false`, both rotate, and one logical session
    // ends up holding two live refresh tokens. Folding the predicate into the UPDATE
    // makes it a compare-and-swap, so exactly one caller wins and mints the replacement.
    // The loser is a benign race, NOT theft — deny it without touching the family.
    if (!(await this.claimRefreshToken(rawToken))) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const rawUser = existing.user;
    const user = {
      id: rawUser.id, email: rawUser.email, role: rawUser.role, tenantId: rawUser.tenantId,
    };

    const accessToken = this.generateAccessToken({
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId,
    });
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo, ip, userAgent);

    return { accessToken, refreshToken, user };
  }

  private async handleReusedToken(userId: string, _revokedTokenId: string): Promise<void> {
    const allTokens = await this.drizzle.db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false),
      ));

    const tokenIds = allTokens.map(t => t.id);
    if (tokenIds.length > 0) {
      await this.drizzle.db
        .update(refreshTokens)
        .set({ isRevoked: true, revokedAt: new Date() })
        .where(inArray(refreshTokens.id, tokenIds));
    }

    await this.drizzle.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isRevoked, false),
      ));
  }

  /**
   * Atomically claim a refresh token for rotation.
   *
   * Returns true only for the caller that actually flipped `isRevoked` from false to
   * true. Every other concurrent caller gets false and must deny the request — but
   * must NOT run the reuse response, because a simultaneous refresh by the legitimate
   * client is indistinguishable from a race and revoking the family would sign the
   * user out of every device.
   */
  async claimRefreshToken(rawToken: string): Promise<boolean> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const claimed = await this.drizzle.db
      .update(refreshTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.isRevoked, false)))
      .returning({ id: refreshTokens.id });

    const won = Array.isArray(claimed) && claimed.length > 0;

    if (won) {
      // Keep the session list in step with the token table. Rotation used to call
      // revokeRefreshToken(), which ended BOTH rows; the claim must do the same or
      // `getUserSessions` accumulates one stale row per refresh.
      await this.drizzle.db
        .update(userSessions)
        .set({ isRevoked: true })
        .where(eq(userSessions.tokenHash, tokenHash));
    }

    return won;
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.drizzle.db
      .update(refreshTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    await this.drizzle.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(eq(userSessions.tokenHash, tokenHash));
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.drizzle.db
      .update(refreshTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.isRevoked, false)));

    await this.drizzle.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isRevoked, false)));
  }

  async getUserSessions(userId: string): Promise<any[]> {
    return this.drizzle.db.query.userSessions.findMany({
      where: and(eq(userSessions.userId, userId), eq(userSessions.isRevoked, false)),
      orderBy: (sessions: any, { desc }: any) => [desc(sessions.lastActiveAt)],
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.drizzle.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)));
  }

  generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(randomBytes(5).toString('hex').toUpperCase());
    }
    return codes;
  }


  private aesKey(): Buffer {
    const secret = process.env.AUTH_SECRET || 'cookie-secret-change-me';
    return scryptSync(secret, 'impersonation-refresh', 32);
  }

  encryptWithSecret(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.aesKey(), iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
  }

  decryptWithSecret(payload: string): string | null {
    try {
      const [ivB64, dataB64, tagB64] = payload.split('.');
      if (!ivB64 || !dataB64 || !tagB64) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.aesKey(), Buffer.from(ivB64, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]);
      return dec.toString('utf8');
    } catch {
      return null;
    }
  }

  @Cron('0 3 * * *')
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    await this.drizzle.db.delete(refreshTokens).where(lte(refreshTokens.expiresAt, now));
    await this.drizzle.db.delete(userSessions).where(lte(userSessions.expiresAt, now));
    try {
      await this.drizzle.db.delete(impersonationSessions).where(lte(impersonationSessions.expiresAt, now));
    } catch {}
    try {
      await this.drizzle.db.delete(oauthStates).where(lte(oauthStates.expiresAt, now));
    } catch {}
  }
}
