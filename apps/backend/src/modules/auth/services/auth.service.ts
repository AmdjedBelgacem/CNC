import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { users } from '../../../database/schema/users';
import { userTenantRoles, verificationTokens as vt, refreshTokens as rt, userSessions as us, impersonationSessions } from '../../../database/schema/auth';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuditService } from './audit.service';
import { TotpService } from './totp.service';
import { OAuthService } from './oauth.service';
import { EmailVerificationService } from './email-verification.service';
import { LockoutService } from './lockout.service';
import { EmailService } from './email.service';
import { KeyManagementService } from './key-management.service';
import { RbacService } from '../../rbac/rbac.service';
import { eq, and, isNull, gte, lte, or, ilike, sql, gt, desc } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private auditService: AuditService,
    private totpService: TotpService,
    private oauthService: OAuthService,
    private emailVerificationService: EmailVerificationService,
    private lockoutService: LockoutService,
    private emailService: EmailService,
    private keyManagement: KeyManagementService,
    private rbac: RbacService,
  ) {}

  get password() { return this.passwordService; }
  get token() { return this.tokenService; }
  get audit() { return this.auditService; }
  get totp() { return this.totpService; }
  get oauth() { return this.oauthService; }
  get emailVerification() { return this.emailVerificationService; }
  get lockout() { return this.lockoutService; }
  get email() { return this.emailService; }

  /**
   * Public profile routes resolve users by `username` (`GET /profile/:username`).
   * Registration used to store `null` unless the client supplied one, so most
   * accounts were unreachable at their profile URL. Derive a stable, URL-safe
   * handle from the email local-part (falling back to the display name) and
   * de-duplicate with a numeric suffix.
   */
  private async deriveUsername(email: string, name?: string): Promise<string> {
    const base = (email.split('@')[0] || name || 'user')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '')
      .slice(0, 40);
    const seed = base.length >= 3 ? base : `user-${base || 'member'}`;
    const taken = await this.drizzle.db.query.users.findFirst({
      where: eq(users.username, seed),
      columns: { id: true },
    });
    if (!taken) return seed;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${seed}-${i}`.slice(0, 100);
      const clash = await this.drizzle.db.query.users.findFirst({
        where: eq(users.username, candidate),
        columns: { id: true },
      });
      if (!clash) return candidate;
    }
    return `${seed}-${Date.now().toString(36)}`.slice(0, 100);
  }

  async register(params: {
    email: string;
    password: string;
    name: string;
    tenantId: string;
    tenantSlug?: string;
    username?: string;
  }) {
    const existing = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.email, params.email), eq(users.tenantId, params.tenantId)),
    });

    if (existing) {
      if (existing.emailVerifiedAt) {
        throw new ConflictException('An account with this email already exists');
      }
      if (existing.accountStatus === 'deleted') {
        throw new ConflictException('An account with this email was deleted');
      }
      throw new ConflictException('An account with this email is pending verification. Please check your email or request a new verification link.');
    }

    if (params.username) {
      const existingUsername = await this.drizzle.db.query.users.findFirst({
        where: eq(users.username, params.username),
      });
      if (existingUsername) {
        throw new ConflictException('Username is already taken');
      }
    }

    // Always store a handle so /profile/:username resolves for every account.
    const username = params.username || (await this.deriveUsername(params.email, params.name));

    const passwordHash = await this.passwordService.hash(params.password);

    const created = await this.drizzle.db.insert(users).values({
      tenantId: params.tenantId,
      email: params.email,
      name: params.name,
      username,
      passwordHash,
      role: 'learner',
      accountStatus: 'pending_verification',
      isActive: true,
      passwordChangedAt: new Date(),
    }).returning();

    if (!created?.[0]) throw new Error('Failed to create user');
    const user = created[0];

    const verificationToken = await this.emailVerificationService.sendVerificationEmail(
      user.id, user.email, params.tenantSlug,
    );

    await this.auditService.log({
      userId: user.id, action: 'user.register',
      entityType: 'user', entityId: user.id,
      details: { email: user.email, tenantId: params.tenantId },
    });

    return { user, verificationToken };
  }

  async login(params: {
    email: string;
    password: string;
    tenantId: string;
    ip?: string;
    userAgent?: string;
    rememberDevice?: boolean;
  }) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.email, params.email), eq(users.tenantId, params.tenantId)),
    });

    if (!user) {
      await this.delay(100 + (randomBytes(1)[0] || 0) % 100);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus === 'deleted') {
      await this.delay(100 + (randomBytes(1)[0] || 0) % 100);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus === 'suspended') {
      throw new ForbiddenException('Your account has been suspended. Contact support.');
    }

    const lockStatus = await this.lockoutService.isLocked(params.email);
    if (lockStatus.locked) {
      const mins = Math.ceil((lockStatus.lockedUntil!.getTime() - Date.now()) / 60000);
      throw new HttpException(`Account temporarily locked. Try again in ${mins} minutes.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!user.passwordHash) {
      await this.delay(100 + (randomBytes(1)[0] || 0) % 100);
      await this.lockoutService.recordFailedAttempt(params.email, params.ip || '');
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await this.passwordService.verify(user.passwordHash, params.password);
    if (!validPassword) {
      const result = await this.lockoutService.recordFailedAttempt(params.email, params.ip || '', params.userAgent);
      await this.auditService.log({
        userId: user.id, action: 'user.login.failed',
        entityType: 'user', entityId: user.id,
        details: { reason: 'invalid_password', remainingAttempts: result.remainingAttempts },
        ip: params.ip, userAgent: params.userAgent, tenantId: params.tenantId,
      });

      if (result.locked) {
        throw new HttpException('Account locked due to too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus === 'pending_verification') {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    await this.lockoutService.resetAttempts(user.id);

    // SECURITY: never mint session tokens until 2FA is satisfied.
    if (user.twoFactorEnabled) {
      await this.auditService.log({
        userId: user.id, action: 'user.login.2fa_pending', entityType: 'user', entityId: user.id,
        details: { rememberDevice: params.rememberDevice }, ip: params.ip, userAgent: params.userAgent, tenantId: params.tenantId,
      });
      return { user: await this.sanitizeUser(user), twoFactorRequired: true as const };
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId,
    });

    const refreshToken = await this.tokenService.generateRefreshToken(
      user.id, undefined, params.ip, params.userAgent, params.rememberDevice,
    );

    await this.drizzle.db
      .update(users)
      .set({ lastLoginAt: new Date(), lastLoginIp: params.ip || null, lastLoginUserAgent: params.userAgent || null })
      .where(eq(users.id, user.id));

    await this.auditService.log({
      userId: user.id, action: 'user.login', entityType: 'user', entityId: user.id,
      details: { rememberDevice: params.rememberDevice }, ip: params.ip, userAgent: params.userAgent, tenantId: params.tenantId,
    });

    return { accessToken, refreshToken, user: await this.sanitizeUser(user), twoFactorRequired: false as const };
  }

  async loginWithOauth(params: {
    provider: string; providerAccountId: string; email: string; name: string;
    avatarUrl?: string; tenantId: string; ip?: string; userAgent?: string;
  }) {
    const oauthResult = await this.oauthService.findAccount(params.provider, params.providerAccountId);

    let user: any;

    if (!oauthResult) {
      user = await this.drizzle.db.query.users.findFirst({
        where: and(eq(users.email, params.email), eq(users.tenantId, params.tenantId)),
      });

      if (!user) {
        const username = await this.deriveUsername(params.email, params.name);
        const created = await this.drizzle.db.insert(users).values({
          tenantId: params.tenantId, email: params.email, name: params.name,
          username, avatarUrl: params.avatarUrl || null, role: 'learner',
          accountStatus: 'active', emailVerifiedAt: new Date(), isActive: true,
        }).returning();

        if (!created?.[0]) throw new Error('Failed to create user');
        user = created[0];
      } else if (!user.emailVerifiedAt) {
        await this.drizzle.db
          .update(users).set({ emailVerifiedAt: new Date(), accountStatus: 'active' })
          .where(eq(users.id, user.id));
      }

      await this.oauthService.linkAccount({
        userId: user.id, provider: params.provider,
        providerAccountId: params.providerAccountId, providerEmail: params.email, avatarUrl: params.avatarUrl,
      });
    } else {
      user = oauthResult.user;
    }

    if (!user || user.accountStatus === 'deleted' || user.accountStatus === 'suspended') {
      throw new UnauthorizedException('Account is not accessible');
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId,
    });

    const refreshToken = await this.tokenService.generateRefreshToken(user.id, undefined, params.ip, params.userAgent);

    await this.drizzle.db
      .update(users).set({ lastLoginAt: new Date(), lastLoginIp: params.ip || null, lastLoginUserAgent: params.userAgent || null })
      .where(eq(users.id, user.id));

    await this.auditService.log({
      userId: user.id, action: 'user.login', entityType: 'user', entityId: user.id,
      details: { provider: params.provider }, ip: params.ip, userAgent: params.userAgent, tenantId: params.tenantId,
    });

    if (user.twoFactorEnabled) {
      await this.auditService.log({
        userId: user.id, action: 'user.login.2fa_pending', entityType: 'user', entityId: user.id,
        details: { provider: params.provider }, ip: params.ip, userAgent: params.userAgent, tenantId: params.tenantId,
      });
      return { user: await this.sanitizeUser(user), twoFactorRequired: true as const };
    }
    return { accessToken, refreshToken, user: await this.sanitizeUser(user), twoFactorRequired: false as const };
  }

  async refreshAccessToken(refreshToken: string, ip?: string, userAgent?: string) {
    return this.tokenService.verifyAndRotateRefreshToken(refreshToken, undefined, ip, userAgent);
  }

  async logout(rawToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(rawToken);
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
    await this.auditService.log({ userId, action: 'user.logout', entityType: 'user', entityId: userId, details: { everywhere: true } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new BadRequestException('User not found');
    if (!user.passwordHash) throw new BadRequestException('Password login is not set up for this account');

    const valid = await this.passwordService.verify(user.passwordHash, currentPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const newHash = await this.passwordService.hash(newPassword);
    await this.drizzle.db.update(users).set({ passwordHash: newHash, passwordChangedAt: new Date() }).where(eq(users.id, userId));
    await this.tokenService.revokeAllUserTokens(userId);

    this.emailService.sendPasswordChangedNotification(user.email);

    await this.auditService.log({ userId, action: 'user.password.change', entityType: 'user', entityId: userId });
  }

  async requestEmailChange(userId: string, newEmail: string, password: string, tenantId: string): Promise<{ message: string }> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new BadRequestException('User not found');
    if (user.passwordHash) {
      const valid = await this.passwordService.verify(user.passwordHash, password);
      if (!valid) throw new BadRequestException('Password is incorrect');
    }
    const existing = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.email, newEmail), eq(users.tenantId, tenantId)),
    });
    if (existing) throw new ConflictException('Email is already in use');
    if (user.email === newEmail) throw new BadRequestException('New email is the same as current email');

    const rawToken = this.tokenService.generateVerificationToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.drizzle.db.insert(vt).values({ userId, tokenHash, type: 'email_change', metadata: { newEmail }, expiresAt });

    this.emailService.sendEmailChangeVerification(newEmail, rawToken, tenantId);

    await this.auditService.log({ userId, action: 'user.email.change.request', entityType: 'user', entityId: userId, details: { newEmail } });
    return { message: 'Verification email sent to new address' };
  }

  async confirmEmailChange(token: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(token);
    const record = await this.drizzle.db.query.verificationTokens.findFirst({
      where: and(eq(vt.tokenHash, tokenHash), eq(vt.type, 'email_change'), isNull(vt.usedAt)),
      with: { user: true },
    });
    if (!record || !record.user) throw new BadRequestException('Invalid or expired token');
    if (new Date() > new Date(record.expiresAt)) throw new BadRequestException('Token has expired');

    const pendingEmail = record.metadata?.newEmail;
    if (!pendingEmail) throw new BadRequestException('No pending email change found');

    const oldEmail = record.user.email;

    await this.drizzle.db.update(users).set({ email: pendingEmail }).where(eq(users.id, record.userId));
    await this.drizzle.db.update(vt).set({ usedAt: new Date() }).where(eq(vt.id, record.id));
    await this.tokenService.revokeAllUserTokens(record.userId);

    this.emailService.sendEmailChangedNotification(oldEmail, pendingEmail);

    await this.auditService.log({ userId: record.userId, action: 'user.email.change.confirm', entityType: 'user', entityId: record.userId, details: { oldEmail, newEmail: pendingEmail } });
  }

  async getProfile(userId: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { oauthAccounts: true, tenantRoles: { with: { tenant: true } }, tenant: true },
    });
    if (!user) throw new BadRequestException('User not found');
    return await this.sanitizeUser(user);
  }

  async getTenantRoles(userId: string) {
    return this.drizzle.db.query.userTenantRoles.findMany({
      where: eq(userTenantRoles.userId, userId), with: { tenant: true },
    });
  }

  async addTenantRole(userId: string, tenantId: string, role: string) {
    await this.drizzle.db.insert(userTenantRoles).values({ userId, tenantId, role }).onConflictDoNothing();
    await this.auditService.log({
      userId, action: 'user.role.change', entityType: 'user_tenant_role', details: { tenantId, role, added: true },
    });
  }

  async removeTenantRole(userId: string, tenantId: string, role: string) {
    await this.drizzle.db.delete(userTenantRoles)
      .where(and(eq(userTenantRoles.userId, userId), eq(userTenantRoles.tenantId, tenantId), eq(userTenantRoles.role, role)));
  }

  async getSessions(userId: string, currentSessionTokenHash?: string) {
    const sessions = await this.tokenService.getUserSessions(userId);
    return sessions.map((s: any) => ({
      id: s.id, deviceInfo: s.deviceInfo, ip: s.ip, userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt, createdAt: s.createdAt,
      isCurrent: currentSessionTokenHash ? s.tokenHash === currentSessionTokenHash : false,
    }));
  }

  async revokeSession(sessionId: string, userId: string) {
    await this.tokenService.revokeSession(sessionId, userId);
    await this.auditService.log({
      userId, action: 'user.logout', entityType: 'session', entityId: sessionId, details: { sessionRevoked: true },
    });
  }

  async getUsersForAdmin(options: {
    tenantId?: string; accountStatus?: string; role?: string; search?: string; limit?: number; offset?: number;
    joinedFrom?: string; joinedTo?: string;
  }) {
    const conditions: any[] = [];
    if (options.tenantId) conditions.push(eq(users.tenantId, options.tenantId));
    if (options.accountStatus) conditions.push(eq(users.accountStatus, options.accountStatus));
    if (options.role) conditions.push(eq(users.role, options.role));
    if (options.joinedFrom) conditions.push(gte(users.createdAt, new Date(options.joinedFrom)));
    if (options.joinedTo) conditions.push(lte(users.createdAt, new Date(`${options.joinedTo}T23:59:59.999Z`)));
    if (options.search) {
      const pattern = `%${options.search}%`;
      conditions.push(
        or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(sql`COALESCE(${users.username}, '')`, pattern)),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [results, totalArr] = await Promise.all([
      this.drizzle.db.query.users.findMany({
        where,
        limit: options.limit || 50, offset: options.offset || 0,
        orderBy: (u: any, { desc }: any) => [desc(u.createdAt)],
      }),
      this.drizzle.db.select({ count: sql<number>`count(*)::int` }).from(users).where(where as any),
    ]);

    return { items: await Promise.all(results.map((u: any) => this.sanitizeUser(u))), total: Number(totalArr[0]?.count ?? 0) };
  }

  async adminChangeUserRole(adminUserId: string, targetUserId: string, newRole: string): Promise<void> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!user) throw new BadRequestException('User not found');
    const oldRole = user.role;
    await this.drizzle.db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
    await this.auditService.log({
      userId: adminUserId, action: 'user.role.change', entityType: 'user', entityId: targetUserId, details: { oldRole, newRole },
    });
  }

  async adminSuspendUser(adminUserId: string, targetUserId: string, reason?: string): Promise<void> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!user) throw new BadRequestException('User not found');
    await this.drizzle.db.update(users).set({ accountStatus: 'suspended' }).where(eq(users.id, targetUserId));
    await this.tokenService.revokeAllUserTokens(targetUserId);
    await this.auditService.log({
      userId: adminUserId, action: 'user.suspend', entityType: 'user', entityId: targetUserId, details: { reason },
    });
  }

  async adminUnsuspendUser(adminUserId: string, targetUserId: string): Promise<void> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!user) throw new BadRequestException('User not found');
    await this.drizzle.db.update(users).set({
      accountStatus: 'active', failedLoginAttempts: 0, lockedUntil: null,
    }).where(eq(users.id, targetUserId));
    await this.auditService.log({
      userId: adminUserId, action: 'user.unsuspend', entityType: 'user', entityId: targetUserId,
    });
  }

  async adminForcePasswordReset(adminUserId: string, targetUserId: string, tenantSlug?: string): Promise<{ resetToken: string | null }> {
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!user) throw new BadRequestException('User not found');
    await this.tokenService.revokeAllUserTokens(targetUserId);
    await this.drizzle.db.update(users).set({ passwordHash: null }).where(eq(users.id, targetUserId));
    const resetToken = await this.emailVerificationService.createPasswordResetToken(user.email, user.tenantId, tenantSlug);
    await this.auditService.log({
      userId: adminUserId, action: 'admin.password.reset', entityType: 'user', entityId: targetUserId, details: { forceReset: true },
    });
    return { resetToken };
  }

  async impersonateUser(
    adminUserId: string,
    targetUserId: string,
    ip?: string,
    userAgent?: string,
    adminRefreshRaw?: string | null,
  ) {
    const targetUser = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!targetUser || targetUser.accountStatus === 'deleted') {
      throw new BadRequestException('Cannot impersonate this user');
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: targetUser.id, email: targetUser.email, role: targetUser.role, tenantId: targetUser.tenantId,
      impersonating: true,
      impersonatedBy: adminUserId,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(targetUser.id, undefined, ip, userAgent);

    // Impersonation sessions are short-lived (15m)
    const shortExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const rawHash = this.tokenService.hashToken(refreshToken);
    await this.drizzle.db.update(rt).set({ expiresAt: shortExpiry }).where(eq(rt.tokenHash, rawHash));
    await this.drizzle.db.update(us).set({ expiresAt: shortExpiry }).where(eq(us.tokenHash, rawHash));

    // Store admin's refresh token ENCRYPTED so /impersonate/end can restore their session
    const adminRefreshEncrypted = adminRefreshRaw ? this.tokenService.encryptWithSecret(adminRefreshRaw) : null;

    // Invalidate any previous impersonation rows for this admin->target pair FIRST.
    // Without this, every impersonation appended a new row and /impersonate/end's
    // unordered `.limit(1)` lookup could resolve to a stale/expired one, producing
    // "Impersonation session not found or expired" even for a brand-new session.
    await this.drizzle.db.delete(impersonationSessions).where(
      and(
        eq(impersonationSessions.adminUserId, adminUserId),
        eq(impersonationSessions.targetUserId, targetUserId),
      ),
    );

    await this.drizzle.db.insert(impersonationSessions).values({
      adminUserId, targetUserId,
      adminRefreshEncrypted,
      expiresAt: shortExpiry,
    });

    await this.auditService.log({
      userId: adminUserId, action: 'user.impersonate', entityType: 'user', entityId: targetUserId,
      details: { targetEmail: targetUser.email, impersonating: true }, ip, userAgent,
    });

    return {
      accessToken, refreshToken,
      user: await this.sanitizeUser(targetUser),
      impersonating: true, impersonatedBy: adminUserId,
    };
  }

  async endImpersonation(impersonationAccessRaw?: string | null) {
    // Parse the impersonation access token to identify admin + target
    if (!impersonationAccessRaw) throw new ForbiddenException('No impersonation session');
    const parts = impersonationAccessRaw.split('.');
    if (parts.length !== 3) throw new ForbiddenException('Invalid impersonation token');
    let claims: any;
    try {
      claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));
    } catch {
      throw new ForbiddenException('Invalid impersonation token');
    }
    if (!claims?.impersonating || !claims?.impersonatedBy || !claims?.sub) {
      throw new ForbiddenException('Not an impersonation session');
    }
    const adminUserId: string = claims.impersonatedBy;
    const targetUserId: string = claims.sub;

    // Pick the MOST RECENT non-expired session for this admin->target pair.
    // Ordering matters: an unordered `.limit(1)` could return a stale row.
    const rows = await this.drizzle.db.select().from(impersonationSessions).where(
      and(
        eq(impersonationSessions.adminUserId, adminUserId),
        eq(impersonationSessions.targetUserId, targetUserId),
        gt(impersonationSessions.expiresAt, new Date()),
      ),
    ).orderBy(desc(impersonationSessions.createdAt)).limit(1);
    const row = rows?.[0];
    if (!row) {
      throw new ForbiddenException('Impersonation session not found or expired');
    }

    // Denylist the impersonation access jti instantly
    try {
      if (claims.jti) await this.tokenService.denylistAccessToken(claims.jti);
    } catch {}

    await this.drizzle.db.delete(impersonationSessions).where(eq(impersonationSessions.id, row.id));

    await this.auditService.log({
      userId: adminUserId, action: 'user.impersonate.end', entityType: 'user', entityId: targetUserId,
    });

    // Restore admin session by rotating their preserved refresh token
    let restored: { accessToken: string; refreshToken: string; user: any } | null = null;
    if (row.adminRefreshEncrypted) {
      const adminRaw = this.tokenService.decryptWithSecret(row.adminRefreshEncrypted);
      if (adminRaw) {
        try {
          const rotated = await this.tokenService.verifyAndRotateRefreshToken(adminRaw);
          restored = { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken, user: rotated.user };
        } catch {
          // Admin's original refresh expired/revoked — fall through; client must re-login
        }
      }
    }
    return restored;
  }

  async softDeleteUser(userId: string, deletedByUserId: string): Promise<void> {
    await this.drizzle.db.update(users).set({
      accountStatus: 'deleted', deletedAt: new Date(), deletedByUserId,
    }).where(eq(users.id, userId));
    await this.tokenService.revokeAllUserTokens(userId);
    await this.auditService.log({ userId: deletedByUserId, action: 'user.delete', entityType: 'user', entityId: userId });
  }

  async getAuditLogs(params: { userId?: string; action?: string; tenantId?: string; limit?: number; offset?: number }) {
    return this.auditService.getLogs(params);
  }

  async updateProfile(userId: string, data: Partial<{
    name: string; username: string; headline: string; bio: string;
    location: string; language: string; timezone: string;
    avatarUrl: string; coverImageUrl: string;
  }>) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.headline !== undefined) updateData.headline = data.headline;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (Object.keys(updateData).length === 0) throw new BadRequestException('No fields to update');
    updateData.updatedAt = new Date();
    await this.drizzle.db.update(users).set(updateData).where(eq(users.id, userId));
    await this.auditService.log({ userId, action: 'user.profile.update', entityType: 'user', entityId: userId, details: updateData });
    return this.getProfile(userId);
  }

  async getLoginHistory(userId: string, limit = 20) {
    return this.auditService.getLogs({
      userId,
      action: 'user.login',
      limit,
    });
  }

  async deleteMyAccount(userId: string): Promise<void> {
    await this.drizzle.db.update(users).set({
      accountStatus: 'deleted', deletedAt: new Date(), deletedByUserId: userId,
    }).where(eq(users.id, userId));
    await this.tokenService.revokeAllUserTokens(userId);
    await this.auditService.log({ userId, action: 'user.delete.self', entityType: 'user', entityId: userId });
  }

  async exportMyData(userId: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        oauthAccounts: true,
        enrollments: { with: { course: true } },
        certifications: true,
        orders: { with: { items: true } },
        notifications: { orderBy: (n: any, { desc }: any) => [desc(n.createdAt)], limit: 100 },
      },
    });
    if (!user) throw new BadRequestException('User not found');
    return await this.sanitizeUser(user);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.passwordHash) return false;
    return this.passwordService.verify(user.passwordHash, password);
  }

  async generateCsrfToken(): Promise<{ csrfToken: string }> {
    const token = randomBytes(32).toString('hex');
    return { csrfToken: token };
  }

  async rotateSigningKey(): Promise<{ keyId: string; message: string }> {
    const { keyId } = await this.keyManagement.rotateKey(
      process.env.JWT_ACCESS_SECRET || '',
    );
    return { keyId, message: 'Signing key rotated. Previous keys will still verify existing tokens.' };
  }

  private async sanitizeUser(user: any) {
    const { passwordHash, passwordChangedAt, failedLoginAttempts, deletedByUserId, ...safe } = user;
    const tenantRoles = user.tenantRoles?.map((r: any) => ({
      tenantId: r.tenantId, tenantSlug: r.tenant?.slug || '', role: r.role,
    })) || [];
    const permissions = await this.rbac.resolvePermissions(user.id, user.role, user.tenantId);
    return {
      ...safe,
      permissions,
      tenantRoles,
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
