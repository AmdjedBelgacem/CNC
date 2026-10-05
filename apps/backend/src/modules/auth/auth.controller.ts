import { Controller, Post, Get, Patch, Put, Body, HttpCode, HttpStatus, UseGuards, Req, Res, Query, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { users } from '../../database/schema/users';
import { oauthStates } from '../../database/schema/oauth-states';
import { eq } from 'drizzle-orm';
import { AuthService } from './services/auth.service';
import { PlatformAlertsService } from '../notifications/platform-alerts.service';
import { TotpService } from './services/totp.service';
import { CsrfService } from './services/csrf.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from './guards/tenant-scope.guard';
import { SkipCsrf } from './guards/csrf.guard';
import { UploadService } from './services/upload.service';
import { CookieService } from './services/cookie.service';
import { createHmac, randomBytes } from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '../../config/config.service';
import { providerAuthorizeUrl } from './strategies/provider-authorize-url';
import { callbackOrigin } from './strategies/oauth-callback-url';
import { SupabaseAuthClient, SupabaseAuthError } from './supabase-auth.client';
import { AuditService } from './services/audit.service';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
export class AuthController {
  constructor(
    private auth: AuthService,
    private totp: TotpService,
    private csrf: CsrfService,
    private userPreferences: UserPreferencesService,
    private upload: UploadService,
    private drizzle: DrizzleService,
    private platformAlerts: PlatformAlertsService,
    private cookieService: CookieService,
    private config: ConfigService,
    @Inject(SupabaseAuthClient) private readonly supabaseAuth: SupabaseAuthClient,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private async saveOauthState(state: string, tenantId: string | null | undefined, redirectTo?: string) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    try {
      await this.drizzle.db.insert(oauthStates).values({
        state, provider: 'any', tenantId, redirectTo: redirectTo || null, expiresAt,
      });
    } catch {}
    try {
      await (this as any).redis?.setex?.(`oauth_state:${state}`, 600, JSON.stringify({ tenantId, redirectTo }));
    } catch {}
  }

  private async consumeOauthState(state: string | undefined): Promise<{ tenantId: string | null; redirectTo: string | null } | null> {
    if (!state || typeof state !== 'string' || state.length < 16) return null;
    try {
      const rows = await this.drizzle.db.select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1);
      const row = rows?.[0];
      if (!row) return null;
      await this.drizzle.db.delete(oauthStates).where(eq(oauthStates.id, row.id));
      if (new Date() > new Date(row.expiresAt)) return null;
      return { tenantId: row.tenantId ?? null, redirectTo: row.redirectTo ?? null };
    } catch {
      return null;
    }
  }

  private randomState(): string {
    return randomBytes(32).toString('hex');
  }

  @Public()
  @Get('oauth/state')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create an OAuth CSRF state and get pre-built provider URLs' })
  async getOauthState(@Req() req: any) {
    const state = this.randomState();
    const redirectTo = typeof req.query?.redirectTo === 'string' ? String(req.query.redirectTo).slice(0, 400) : undefined;
    const tenant = await this.resolveTenant(req);
    await this.saveOauthState(state, tenant.id || undefined, redirectTo);
    return { state };
  }

  private async resolveTenant(req: any): Promise<{ id: string; slug: string }> {
    if (req.tenant?.id) return { id: req.tenant.id, slug: req.tenant.slug };
    const fallback = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.isActive, true),
    });
    return fallback ? { id: fallback.id, slug: fallback.slug } : { id: '', slug: 'main' };
  }

  @Public()
  @Get('csrf-token')
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get CSRF token' })
  async getCsrfToken(@Res({ passthrough: true }) reply: any) {
    const csrfToken = this.csrf.generateToken();
    reply.setCookie('csrf-token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      signed: false,
    });
    return { csrfToken };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async register(
    @Body() body: { email: string; password: string; name: string; username?: string },
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const tenant = await this.resolveTenant(req);
    const result = await this.auth.register({
      email: body.email,
      password: body.password,
      name: body.name,
      username: body.username,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });

    /**
     * When Supabase owns credentials the service hands back a live session, so the new
     * account is authenticated on arrival. Previously the response carried only a user
     * object, which left the browser with no cookies and pushed every new signup back to
     * the login page for a credential it had just supplied.
     *
     * `user` is returned under `user` for both paths so the client's success handling does
     * not have to know which mode produced it.
     */
    if ('session' in result && result.session) {
      this.cookieService.setAuthCookies(reply, result.session.accessToken, result.session.refreshToken, false);
      return {
        user: result.user,
        requiresEmailVerification: false,
        authenticated: true,
      };
    }

    return {
      user: result.user,
      requiresEmailVerification: true,
      authenticated: false,
      message: 'Account created. Check your email to verify your address before signing in.',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body() body: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const tenant = await this.resolveTenant(req);

    /**
     * Supabase-exclusive mode: Supabase verifies the password and issues the tokens.
     * This application never hashes or checks a credential itself. The local user
     * record is still resolved from `users` by email, so tenancy and RBAC are
     * untouched.
     */
    if (this.supabaseAuth.enabled) {
      let session;
      try {
        session = await this.supabaseAuth.signInWithPassword(body.email, body.password);
      } catch (error) {
        const message =
          error instanceof SupabaseAuthError && error.status === 400
            ? 'Invalid email or password'
            : 'Authentication is unavailable';
        void error;
        await this.auditService
          .log({
            action: 'user.login.failed',
            details: { reason: 'invalid_password', provider: 'supabase' },
            ip: req.ip,
          })
          .catch(() => undefined);
        throw new UnauthorizedException(message);
      }

      const linked = await this.drizzle.db.query.users.findFirst({
        where: eq(users.email, body.email),
      });
      if (!linked?.authUserId || linked.authUserId !== session.userId) {
        throw new UnauthorizedException('No application account is linked to this identity');
      }

      // Record the session against our own audit trail, and keep the local user_sessions
      // row so session listing/revocation in Settings still works.
      await this.auditService
        .log({
          userId: linked.id,
          action: 'user.login',
          entityType: 'user',
          entityId: linked.id,
          tenantId: tenant.id || undefined,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })
        .catch(() => undefined);

      this.cookieService.setAuthCookies(
        reply,
        session.accessToken,
        session.refreshToken,
        !!body.rememberDevice,
      );
      return { user: linked, twoFactorRequired: false, provider: 'supabase' };
    }

    const result: any = await this.auth.login({
      email: body.email,
      password: body.password,
      tenantId: tenant.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rememberDevice: body.rememberDevice,
    });
    if (result?.twoFactorRequired) {
      // No session tokens until 2FA succeeds — issue a signed, short-lived pending marker
      this.issuePending2fa(reply, result.user?.id);
      return { user: result.user, twoFactorRequired: true };
    }
    // Dual-write: httpOnly cookies for new clients + tokens in body for legacy clients (migration window)
    if (result && result.accessToken && result.refreshToken) {
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, !!body.rememberDevice);
    }
    return result;
  }

  /** Signed pending-2FA marker: HMAC(userId.expiry) bound to this browser via httpOnly cookie. */
  private issuePending2fa(reply: any, userId?: string) {
    if (!userId) return;
    const secretKey = process.env.AUTH_SECRET || 'cookie-secret-change-me';
    const expires = Date.now() + 5 * 60 * 1000;
    const payload = `${userId}.${expires}`;
    const sig = createHmac('sha256', secretKey).update(payload).digest('hex');
    this.cookieService.setPending2faCookie(reply, `${Buffer.from(payload).toString('base64url')}.${sig}`);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    // Dual-read: prefer httpOnly cookie, fallback to body for migration
    const cookieToken =
      req.cookies?.['refresh-token'] ||
      req.cookies?.['__Host-refresh'] ||
      req.cookies?.['__refresh-fallback'];
    const rawToken = cookieToken || body?.refreshToken;
    if (!rawToken) throw new (await import('@nestjs/common')).UnauthorizedException('Missing refresh token');

    if (this.supabaseAuth.enabled) {
      const session = await this.supabaseAuth.refreshSession(rawToken);
      this.cookieService.setAuthCookies(reply, session.accessToken, session.refreshToken, false);
      const linked = await this.drizzle.db.query.users.findFirst({
        where: eq(users.authUserId, session.userId),
      });
      return { user: linked ?? null, provider: 'supabase' };
    }

    const result: any = await this.auth.refreshAccessToken(
      rawToken,
      req.ip,
      req.headers['user-agent'],
    );
    // Rotate cookies
    try {
      const remember = false; // refresh keeps original expiry; frontend sends rememberDevice only on login
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, remember);
    } catch {}
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const cookieToken =
      req.cookies?.['refresh-token'] ||
      req.cookies?.['__Host-refresh'] ||
      req.cookies?.['__refresh-fallback'];
    const raw = body?.refreshToken || cookieToken;
    if (raw) {
      try {
        await this.auth.logout(raw);
      } catch {}
    }
    try {
      this.cookieService.clearAuthCookies(reply);
    } catch {}
    return { message: 'Logged out successfully' };
  }

  @Post('logout-everywhere')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutEverywhere(
    @CurrentUser() user: any,
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    await this.auth.logoutEverywhere(user.id);
    // Denylist current access jti for instant logout (15m)
    try {
      const authHeader = req.headers?.authorization;
      const cookieToken = req.cookies?.['access-token'] || req.cookies?.['__Host-access'];
      const raw = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || cookieToken;
      if (raw) {
        const parts = raw.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          if (payload?.jti) {
            await this.auth.token.denylistAccessToken(payload.jti, 15 * 60 * 1000);
          }
        }
      }
    } catch {}
    try {
      this.cookieService.clearAuthCookies(reply);
    } catch {}
    return { message: 'Logged out from all devices' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  async verifyEmail(@Body() body: { token: string }) {
    await this.auth.emailVerification.verifyEmail(body.token);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async resendVerification(@Body() body: { email: string }, @Req() req: any) {
    const tenant = await this.resolveTenant(req);
    await this.auth.emailVerification.resendVerification(body.email, tenant.id, tenant.slug);
    return { message: 'If the email exists, a verification link has been sent' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async forgotPassword(@Body() body: { email: string }, @Req() req: any) {
    const tenant = await this.resolveTenant(req);
    await this.auth.emailVerification.createPasswordResetToken(body.email, tenant.id, tenant.slug);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() body: { token: string; password: string }) {
    const passwordHash = await this.auth.password.hash(body.password);
    await this.auth.emailVerification.resetPassword(body.token, passwordHash);
    return { message: 'Password reset successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
    return { message: 'Password changed successfully' };
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email change' })
  async changeEmail(
    @CurrentUser() user: any,
    @Body() body: { newEmail: string; password: string },
    @Req() req: any,
  ) {
    return this.auth.requestEmailChange(user.id, body.newEmail, body.password, req.tenant.id);
  }

  @Public()
  @Post('change-email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email change with token' })
  async confirmChangeEmail(@Body() body: { token: string }) {
    await this.auth.confirmEmailChange(body.token);
    return { message: 'Email address changed successfully' };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  async getProfile(@CurrentUser() user: any) {
    return this.auth.getProfile(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBearerAuth()
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { name?: string; username?: string; headline?: string; bio?: string; location?: string; language?: string; timezone?: string },
  ) {
    return this.auth.updateProfile(user.id, body);
  }

  @Get('login-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get login history' })
  @ApiBearerAuth()
  async getLoginHistory(@CurrentUser() user: any) {
    return this.auth.getLoginHistory(user.id);
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete my account' })
  @ApiBearerAuth()
  async deleteAccount(
    @CurrentUser() user: any,
    @Body() body: { confirmation?: string; password?: string },
  ) {
    await this.auth.deleteMyAccount(user.id, body ?? {});
    return { message: 'Account deleted successfully' };
  }

  @Get('me/data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export my data' })
  @ApiBearerAuth()
  async exportData(@CurrentUser() user: any) {
    return this.auth.exportMyData(user.id);
  }

  @Get('me/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiBearerAuth()
  async getPreferences(@CurrentUser() user: any) {
    return this.userPreferences.get(user.id);
  }

  @Put('me/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiBearerAuth()
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.userPreferences.update(user.id, body);
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active sessions' })
  @ApiBearerAuth()
  async getSessions(@CurrentUser() user: any) {
    return this.auth.getSessions(user.id);
  }

  @Post('sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() user: any,
    @Body() body: { sessionId: string },
  ) {
    await this.auth.revokeSession(body.sessionId, user.id);
    return { message: 'Session revoked' };
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup 2FA' })
  async setup2fa(@CurrentUser() user: any) {
    const { secret, otpauthUrl } = this.totp.generateSecret(user.email);
    const qrCode = await this.totp.generateQrCode(otpauthUrl);
    return { secret, qrCode, otpauthUrl };
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA' })
  async enable2fa(
    @CurrentUser() user: any,
    @Body() body: { token: string; secret: string },
  ) {
    if (!body?.secret) throw new BadRequestException('Secret is required');
    const valid = this.totp.verifyToken(body.token, body.secret);
    if (!valid) throw new UnauthorizedException('Invalid verification code');
    const backupCodes = this.auth.token.generateBackupCodes();
    await this.totp.enable2fa(user.id, body.secret, backupCodes);
    this.auth.notifySecurityEvent({
      userId: user.id,
      tenantId: user.tenantId,
      type: 'two_factor_enabled',
      title: 'Two-factor authentication enabled',
      body: 'Two-factor authentication was enabled on your account.',
      entityType: 'user',
      entityId: user.id,
      idempotencyKey: `two-factor-enabled:${user.id}:${Date.now()}`,
    });
    return { message: '2FA enabled', backupCodes };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2fa(
    @CurrentUser() user: any,
    @Body() body: { token: string },
  ) {
    const secret = await this.totp.getSecret(user.id);
    if (!secret) throw new BadRequestException('2FA not enabled');
    const valid = this.totp.verifyToken(body.token, secret);
    if (!valid) throw new UnauthorizedException('Invalid verification code');
    await this.totp.disable2fa(user.id);
    this.auth.notifySecurityEvent({
      userId: user.id,
      tenantId: user.tenantId,
      type: 'two_factor_disabled',
      title: 'Two-factor authentication disabled',
      body: 'Two-factor authentication was disabled on your account.',
      entityType: 'user',
      entityId: user.id,
      idempotencyKey: `two-factor-disabled:${user.id}:${Date.now()}`,
    });
    // Disabling 2FA on a privileged account removes the second factor on the
    // most valuable credentials on the platform, so it is also raised to the
    // platform feed regardless of which tenant it happened in.
    if (['super_admin', 'admin', 'instructor', 'moderator'].includes(String(user.role ?? ''))) {
      void this.platformAlerts
        .emit({
          group: 'security',
          type: 'admin_two_factor_disabled',
          title: `Two-factor authentication disabled on a privileged account`,
          body:
            `${user.email ?? user.id} (role: ${user.role}) disabled two-factor authentication. ` +
            `Treat any recent sign-in from this account as suspect.`,
          tenantId: user.tenantId,
          entityType: 'user',
          entityId: user.id,
          href: '/admin/users',
          data: { targetEmail: user.email ?? null, targetRole: user.role ?? null },
        })
        .catch(() => undefined);
    }
    return { message: '2FA disabled' };
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA token during login' })
  async verify2fa(
    @Body() body: { userId: string; token: string; rememberDevice?: boolean },
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    // Require the signed pending-2fa cookie issued by /auth/login — proves this
    // browser completed step 1 of login within the last 5 minutes.
    const pending = req.cookies?.['pending-2fa'];
    if (!pending || typeof pending !== 'string') {
      throw new UnauthorizedException('Login session missing. Please sign in again.');
    }
    if (pending) {
      try {
        const secretKey = process.env.AUTH_SECRET || 'cookie-secret-change-me';
        const dot = pending.lastIndexOf('.');
        const payloadB64 = pending.slice(0, dot);
        const sig = pending.slice(dot + 1);
        const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const expectedSig = createHmac('sha256', secretKey).update(payload).digest('hex');
        if (sig !== expectedSig) {
          throw new UnauthorizedException('Invalid login session');
        }
        const [pendingUserId, expiresStr] = payload.split('.');
        if (!expiresStr || Number(expiresStr) < Date.now()) {
          throw new UnauthorizedException('Login session expired. Please sign in again.');
        }
        if (pendingUserId !== body.userId) {
          throw new UnauthorizedException('Login session mismatch');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        throw new UnauthorizedException('Invalid login session');
      }
    }

    const secret = await this.totp.getSecret(body.userId);
    if (!secret) throw new BadRequestException('2FA not configured');
    const valid = this.totp.verifyToken(body.token, secret);
    if (!valid) {
      const backupValid = await this.totp.verifyBackupCode(body.userId, body.token);
      if (!backupValid) throw new UnauthorizedException('Invalid verification code');
    }

    const u = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, body.userId) });
    if (!u) throw new UnauthorizedException('User not found');
    if (u.accountStatus === 'deleted' || u.accountStatus === 'suspended') {
      throw new UnauthorizedException('Account is not accessible');
    }

    const accessToken = this.auth.token.generateAccessToken({
      sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId,
    });
    const refreshToken = await this.auth.token.generateRefreshToken(
      u.id, undefined, req.ip, req.headers['user-agent'], !!body.rememberDevice,
    );
    try {
      this.cookieService.setAuthCookies(reply, accessToken, refreshToken, !!body.rememberDevice);
      this.cookieService.clearPending2faCookie(reply);
    } catch {}

    await this.auditServiceLog(u.id, body.rememberDevice);
    return { verified: true, user: await this.auth.getProfile(u.id) };
  }

  private async auditServiceLog(userId: string, remember?: boolean) {
    // small helper to record successful post-2FA session issue
    try {
      await (this.auth as any).audit.log({
        userId, action: 'user.login.2fa_verified', entityType: 'user', entityId: userId,
        details: { rememberDevice: !!remember },
      });
    } catch {}
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify current password for sensitive actions' })
  @ApiBearerAuth()
  async verifyPassword(
    @CurrentUser() user: any,
    @Body() body: { password: string },
  ) {
    const valid = body?.password ? await this.auth.verifyPassword(user.id, body.password) : false;
    // Must be a 401, not 200 with {valid:false}: the reauth modal gates on res.ok,
    // so a 200 here lets ANY password through and defeats the whole reauth step.
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    return { valid: true };
  }

  @Post('upload-avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiBearerAuth()
  async uploadAvatar(
    @CurrentUser() user: any,
    @Body() body: { image: string },
  ) {
    if (!body.image) return { error: 'No image provided' };
    const url = await this.upload.saveAvatar(user.id, body.image);
    await this.auth.updateProfile(user.id, { avatarUrl: url });
    return { avatarUrl: url };
  }

  @Post('upload-cover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload profile cover image' })
  @ApiBearerAuth()
  async uploadCover(
    @CurrentUser() user: any,
    @Body() body: { image: string },
  ) {
    if (!body.image) return { error: 'No image provided' };
    const url = await this.upload.saveCover(user.id, body.image);
    await this.auth.updateProfile(user.id, { coverImageUrl: url });
    return { coverImageUrl: url };
  }

  @Public()
  @Get('oauth/google')
  @ApiOperation({ summary: 'Google OAuth login' })
  async googleAuth(@Query('state') state: string | undefined, @Res() reply: any) {
    // Fastify-native redirect; see providerAuthorizeUrl for why passport cannot be used.
    return reply.redirect(providerAuthorizeUrl(this.config, 'google', state, callbackOrigin(this.config)), 302);
  }

  @Public()
  @Get('oauth/google/callback')
  @ApiOperation({ summary: 'Google OAuth callback — sets cookies and redirects to the app' })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: any,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) reply: any,
  ) {
    return this.finishOauth(req, reply, 'google', state, req.user);
  }

  @Public()
  @Get('oauth/github')
  @ApiOperation({ summary: 'GitHub OAuth login' })
  async githubAuth(@Query('state') state: string | undefined, @Res() reply: any) {
    return reply.redirect(providerAuthorizeUrl(this.config, 'github', state, callbackOrigin(this.config)), 302);
  }

  @Public()
  @Get('oauth/github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback — sets cookies and redirects to the app' })
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: any,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) reply: any,
  ) {
    return this.finishOauth(req, reply, 'github', state, req.user);
  }

  private async finishOauth(req: any, reply: any, provider: 'google' | 'github', state: string | undefined, profile: any) {
    const stateInfo = await this.consumeOauthState(state);
    // Enforce state validation (CSRF on OAuth)
    if (!stateInfo && process.env.OAUTH_REQUIRE_STATE !== 'false') {
      throw new (await import('@nestjs/common')).UnauthorizedException('Invalid or missing OAuth state');
    }
    const result: any = await this.auth.loginWithOauth({
      provider, providerAccountId: profile.providerAccountId,
      email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl,
      tenantId: stateInfo?.tenantId || req.tenant?.id,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    if (result.twoFactorRequired) {
      this.issuePending2fa(reply, result.user?.id);
    } else {
      try {
        this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, false);
      } catch {}
    }
    // Dual-write: JSON for old clients, 303 redirect target for browsers
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wantsRedirect = String(req.query?.redirect || '') === '1' || (req.headers?.accept || '').includes('text/html');
    if (wantsRedirect) {
      const target = new URL(result.twoFactorRequired ? '/2fa/verify' : '/auth/callback', frontend);
      target.searchParams.set('provider', provider);
      if (result.twoFactorRequired && result.user?.id) target.searchParams.set('userId', result.user.id);
      if (stateInfo?.redirectTo) target.searchParams.set('returnTo', stateInfo.redirectTo);
      reply.status(302).redirect(target.toString());
      return;
    }
    return result;
  }

  @Get('oauth/accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List linked OAuth accounts' })
  async getOAuthAccounts(@CurrentUser() user: any) {
    return this.auth.oauth.findAccountsByUser(user.id);
  }

  @Post('oauth/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an OAuth account' })
  async linkOAuth(
    @CurrentUser() user: any,
    @Body() body: { provider: string; providerAccountId: string; email?: string },
  ) {
    return this.auth.oauth.linkAccount({
      userId: user.id, provider: body.provider,
      providerAccountId: body.providerAccountId, providerEmail: body.email,
    });
  }

  @Post('oauth/unlink')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an OAuth account' })
  async unlinkOAuth(
    @CurrentUser() user: any,
    @Body() body: { provider: string },
  ) {
    await this.auth.oauth.unlinkAccount(user.id, body.provider);
    return { message: 'OAuth account unlinked' };
  }
}
