import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { verificationTokens } from '../../../database/schema/auth';
import { users } from '../../../database/schema/users';
import { TokenService } from './token.service';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { eq, and, isNull } from 'drizzle-orm';
import { ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private drizzle: DrizzleService,
    private tokenService: TokenService,
    private audit: AuditService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a verification token and attempt to email it.
   *
   * Returns the token *and whether it was actually delivered*.
   *
   * The send used to be fire-and-forget — `this.emailService.sendVerificationEmail(...)` was
   * never awaited and the raw token was returned regardless. Every caller therefore believed
   * the mail had gone out, including when Resend rejected it (an unverified sending domain
   * returns 403). That is how signup could report success while no email ever existed.
   * Awaiting the provider result makes the outcome observable.
   *
   * The token row is written either way: a failed send still leaves a valid, unexpired token
   * so "Resend verification" can re-deliver the same link.
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    tenantSlug?: string,
  ): Promise<{ token: string; sent: boolean }> {
    const rawToken = this.tokenService.generateVerificationToken();
    const tokenHash = this.tokenService.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.drizzle.db.insert(verificationTokens).values({
      userId, tokenHash, type: 'email_verification', expiresAt,
    });

    let sent = false;
    try {
      sent = await this.emailService.sendVerificationEmail(email, rawToken, tenantSlug || 'app');
    } catch (error) {
      sent = false;
      this.logger.error(
        `Verification email threw for ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.audit.log({
      userId, action: 'user.email.verify',
      entityType: 'verification_token',
      details: { email, delivered: sent },
    });

    if (!sent) {
      this.logger.error(
        `Verification email NOT delivered to ${email}. The account exists and can sign in; ` +
          'the user can request a new link. Check SMTP_FROM / the sending domain.',
      );
    }

    return { token: rawToken, sent };
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(token);

    const record = await this.drizzle.db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.type, 'email_verification'),
        isNull(verificationTokens.usedAt),
      ),
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new BadRequestException('Verification token has expired');
    }

    await this.drizzle.db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, record.id));

    await this.drizzle.db
      .update(users)
      .set({ emailVerifiedAt: new Date(), accountStatus: 'active' })
      .where(eq(users.id, record.userId));

    await this.audit.log({
      userId: record.userId, action: 'user.email.verify',
      entityType: 'user', entityId: record.userId, details: { verified: true },
    });
  }

  async resendVerification(email: string, tenantId: string, tenantSlug?: string): Promise<void> {
    const user = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.tenantId, tenantId)),
    });

    if (!user) return;
    if (user.emailVerifiedAt) throw new ConflictException('Email is already verified');

    const { sent } = await this.sendVerificationEmail(user.id, user.email, tenantSlug);
    if (!sent) throw new ServiceUnavailableException('Could not send the verification email. Please try again.');
  }

  async createPasswordResetToken(email: string, tenantId: string, tenantSlug?: string): Promise<string | null> {
    const user = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.tenantId, tenantId)),
    });

    if (!user || user.accountStatus === 'deleted') return null;

    const rawToken = this.tokenService.generateVerificationToken();
    const tokenHash = this.tokenService.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.drizzle.db.insert(verificationTokens).values({
      userId: user.id, tokenHash, type: 'password_reset', expiresAt,
    });

    this.emailService.sendPasswordResetEmail(email, rawToken, tenantSlug || 'app');

    await this.audit.log({
      userId: user.id, action: 'user.password.reset',
      entityType: 'password_reset_token', details: { email },
    });

    return rawToken;
  }

  async resetPassword(token: string, newPasswordHash: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(token);

    const record = await this.drizzle.db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.type, 'password_reset'),
        isNull(verificationTokens.usedAt),
      ),
    });

    if (!record) throw new BadRequestException('Invalid or expired reset token');
    if (new Date() > new Date(record.expiresAt)) throw new BadRequestException('Reset token has expired');

    await this.drizzle.db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, record.id));

    await this.drizzle.db
      .update(users)
      .set({
        passwordHash: newPasswordHash, passwordChangedAt: new Date(),
        failedLoginAttempts: 0, lockedUntil: null, accountStatus: 'active',
      })
      .where(eq(users.id, record.userId));

    await this.tokenService.revokeAllUserTokens(record.userId);

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });
    if (user) {
      this.emailService.sendPasswordChangedNotification(user.email);
    }

    await this.audit.log({
      userId: record.userId, action: 'user.password.reset',
      entityType: 'user', entityId: record.userId, details: { passwordReset: true },
    });
  }
}
