import {
  Controller, Post, Get, Patch, Put, Body, HttpCode, HttpStatus, UseGuards, Req, Res,
  Query, Inject, UnauthorizedException, BadRequestException, NotFoundException,
  ServiceUnavailableException,
  UseFilters, Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { users } from '../../database/schema/users';
import { emailEquals } from '../../database/email-match';
import { oauthStates } from '../../database/schema/oauth-states';
import { userSessions } from '../../database/schema/auth';
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
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, RegisterDto, ResetPasswordDto } from './dto/credentials.dto';
import { ConfigService } from '../../config/config.service';
import { isProviderConfigured, providerAuthorizeUrl } from './strategies/provider-authorize-url';
import { callbackOrigin } from './strategies/oauth-callback-url';
import { OauthFailureFilter, oauthFailureUrl } from './strategies/oauth-failure.filter';
import { SupabaseAuthClient, SupabaseAuthError } from './supabase-auth.client';
import { AuditService } from './services/audit.service';
import { EmailOnlyDto, VerifyEmailDto } from './dto/email-verification.dto';
import { UpdatePreferencesDto, UpdateProfileDto } from './dto/profile.dto';
import { TwoFactorAttemptsService } from './services/two-factor-attempts.service';
import { assertAccountUsable } from './account-status';
import { safeRedirectPath } from './safe-redirect';

/**
 * Session tokens travel only as httpOnly cookies. Login and refresh used to echo them in
 * the JSON body too (a "dual-write" for legacy clients), which handed them to any script
 * running on the page. No client reads them from the body.
 */
function withoutTokens<T extends Record<string, unknown>>(result: T) {
  if (!result || typeof result !== 'object') return result;
  const { accessToken: _a, refreshToken: _r, remember: _m, ...rest } = result as Record<string, unknown>;
  return rest as Omit<T, 'accessToken' | 'refreshToken' | 'remember'>;
}

/** Wrong second-factor attempts are capped per IP on top of the per-account counter. */
const TWO_FACTOR_THROTTLE = { default: { ttl: 300_000, limit: 5 } };

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
    @Optional() private readonly twoFactorAttempts?: TwoFactorAttemptsService,
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
    // Only a same-origin path is stored; an absolute or protocol-relative URL here was an
    // open redirect out of the OAuth callback.
    const redirectTo = safeRedirectPath(req.query?.redirectTo) ?? undefined;
    const tenant = await this.resolveTenant(req);
    await this.saveOauthState(state, tenant.id || undefined, redirectTo);
    return { state };
  }

  /**
   * Resolve the tenant a public auth request targets.
   *
   * This used to end with `{ id: '', slug: 'main' }` when nothing resolved. That
   * placeholder looked harmless and was catastrophic: the empty string went
   * straight into `eq(users.tenantId, '')`, and Postgres rejected it with
   *
   *   PostgresError: invalid input syntax for type uuid: ""
   *
   * so an unknown tenant slug surfaced to the caller as an opaque 500. It hit on
   * every public auth route — register, login, forgot-password — which is exactly
   * the set an attacker or a misconfigured client probes first.
   *
   * A missing tenant is not something the caller can fix by retrying, so it is
   * reported as what it is: 404 when a specific slug was asked for and does not
   * exist, and 503 when the platform has no tenant configured at all.
   */
  private async resolveTenant(req: any): Promise<{ id: string; slug: string }> {
    if (req.tenant?.id) return { id: req.tenant.id, slug: req.tenant.slug };

    const rawSlug = req.headers?.['x-tenant-slug'];
    const requestedSlug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : null;

    if (requestedSlug) {
      const match = await this.drizzle.db.query.tenants.findFirst({
        where: eq(tenants.slug, requestedSlug),
      });
      if (match) return { id: match.id, slug: match.slug };
      throw new NotFoundException(`Unknown tenant: ${requestedSlug}`);
    }

    const fallback = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.isActive, true),
    });
    if (!fallback) {
      throw new ServiceUnavailableException(
        'No tenant is configured. Create a tenant row, or send an x-tenant-slug header.',
      );
    }
    return { id: fallback.id, slug: fallback.slug };
  }

  @Public()
  // Session plumbing is cheap and called on every page view and token rotation; it gets its own
  // ceiling so a busy page never reads as "signed out" because the generic limit ran out.
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
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
    @Body() body: RegisterDto,
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
      const emailSent = 'verificationEmailSent' in result ? result.verificationEmailSent === true : false;
      return {
        user: result.user,
        // The account is usable now; the emailed link is what proves the address later.
        requiresEmailVerification: !emailSent,
        authenticated: true,
        verificationEmailSent: emailSent,
        message: emailSent
          ? 'Account created. Check your email to verify your address.'
          : 'Account created. We could not send the verification email — use "Resend verification" to try again.',
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
        where: emailEquals(users.email, body.email),
      });
      if (!linked?.authUserId || linked.authUserId !== session.userId) {
        throw new UnauthorizedException('No application account is linked to this identity');
      }

      /**
       * Supabase proved the password, but the account's state is ours. This branch used to
       * hand over cookies to suspended accounts. The same states `JwtStrategy` refuses are
       * refused here, and the session Supabase just minted is revoked.
       */
      try {
        if (linked.accountStatus === 'pending_verification') {
          // Same text as the first-party path: the login form keys "resend verification" on it.
          throw new UnauthorizedException('Please verify your email address before logging in.');
        }
        assertAccountUsable(linked);
      } catch (error) {
        await this.supabaseAuth.signOut(session.refreshToken);
        throw error;
      }

      /**
       * The password is proven by now, but a second factor is still owed. This branch
       * used to hand over cookies unconditionally, so an account with 2FA enabled
       * signed in with nothing but its password — the factor was silently skipped. The
       * session that was just minted is revoked before the pending marker is issued, so
       * the refused login leaves no live credentials behind.
       */
      if (linked.twoFactorEnabled) {
        await this.supabaseAuth.signOut(session.refreshToken);
        this.issuePending2fa(reply, linked.id);
        await this.auditService
          .log({
            userId: linked.id,
            action: 'user.login.2fa_pending',
            entityType: 'user',
            entityId: linked.id,
            tenantId: tenant.id || undefined,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { provider: 'supabase' },
          })
          .catch(() => undefined);
        // `getProfile`, not the raw row: this is a public response and the row still
        // carries `passwordHash` for accounts that predate Supabase.
        return { user: await this.auth.getProfile(linked.id), twoFactorRequired: true };
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

      /**
       * Supabase owns the credentials, but the application still needs its own session row:
       * Settings lists and revokes sessions from `user_sessions`, and the analytics visitor
       * series reads `last_active_at` from it. This branch previously only wrote an audit log,
       * so every Supabase login left the visitors chart empty forever. The refresh token is a
       * stable per-session secret we can hash without storing the credential itself.
       */
      await this.drizzle.db
        .insert(userSessions)
        .values({
          userId: linked.id,
          tokenHash: createHash('sha256').update(session.refreshToken).digest('hex'),
          deviceInfo: req.headers['user-agent'] || null,
          ip: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          // Supabase refresh sessions default to 30 days; this row is an activity/session
          // index, not a credential validator, so it follows that lifetime.
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .catch(() => undefined);

      this.cookieService.setAuthCookies(
        reply,
        session.accessToken,
        session.refreshToken,
        !!body.rememberDevice,
      );
      return { user: await this.auth.getProfile(linked.id), twoFactorRequired: false, provider: 'supabase' };
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
    if (result && result.accessToken && result.refreshToken) {
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, !!body.rememberDevice);
    }
    return withoutTokens(result);
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
  // Session plumbing is cheap and called on every page view and token rotation; it gets its own
  // ceiling so a busy page never reads as "signed out" because the generic limit ran out.
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
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
      const linked = await this.drizzle.db.query.users.findFirst({
        where: eq(users.authUserId, session.userId),
      });
      // A suspended (or otherwise unusable) account does not get its session renewed.
      if (linked) {
        try {
          assertAccountUsable(linked);
        } catch (error) {
          await this.supabaseAuth.signOut(session.refreshToken);
          try {
            this.cookieService.clearAuthCookies(reply);
          } catch {}
          throw error;
        }
      }
      this.cookieService.setAuthCookies(
        reply,
        session.accessToken,
        session.refreshToken,
        this.cookieService.isRememberedSession(req),
      );
      // `getProfile`, not the raw row: the row carries `passwordHash`, auth ids and IPs.
      return { user: linked ? await this.auth.getProfile(linked.id) : null, provider: 'supabase' };
    }

    const result: any = await this.auth.refreshAccessToken(
      rawToken,
      req.ip,
      req.headers['user-agent'],
    );
    // Rotate cookies
    try {
      // A "Keep me signed in" session keeps its 30-day cookie across rotations.
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, result.remember === true);
    } catch {}
    return withoutTokens(result);
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
  async verifyEmail(@Body() body: VerifyEmailDto) {
    await this.auth.emailVerification.verifyEmail(body.token);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async resendVerification(@Body() body: EmailOnlyDto, @Req() req: any) {
    const tenant = await this.resolveTenant(req);
    await this.auth.emailVerification.resendVerification(body.email, tenant.id, tenant.slug);
    return { message: 'If the email exists, a verification link has been sent' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async forgotPassword(@Body() body: EmailOnlyDto, @Req() req: any) {
    const tenant = await this.resolveTenant(req);
    await this.auth.emailVerification.createPasswordResetToken(body.email, tenant.id, tenant.slug);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const passwordHash = await this.auth.password.hash(body.password);
    await this.auth.emailVerification.resetPassword(body.token, passwordHash);
    return { message: 'Password reset successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: ChangePasswordDto,
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

  // Session plumbing is cheap and called on every page view and token rotation; it gets its own
  // ceiling so a busy page never reads as "signed out" because the generic limit ran out.
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
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
    @Body() body: UpdateProfileDto,
  ) {
    // Explicit keys only: avatar and cover URLs are set by the upload endpoints, never here.
    const { name, username, headline, bio, location, language, timezone } = body;
    return this.auth.updateProfile(user.id, { name, username, headline, bio, location, language, timezone });
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
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.userPreferences.update(user.id, body as Parameters<UserPreferencesService['update']>[1]);
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
  @Throttle(TWO_FACTOR_THROTTLE)
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
  @Throttle(TWO_FACTOR_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2fa(
    @CurrentUser() user: any,
    @Body() body: { token: string },
  ) {
    const secret = await this.totp.getSecret(user.id);
    if (!secret) throw new BadRequestException('2FA not enabled');
    await this.twoFactorAttempts?.assertNotLocked(user.id);
    const valid = this.totp.verifyToken(body.token, secret);
    if (!valid) {
      await this.twoFactorAttempts?.recordFailure(user.id);
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.twoFactorAttempts?.reset(user.id);
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
  @Throttle(TWO_FACTOR_THROTTLE)
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
        const expectedSig = Buffer.from(createHmac('sha256', secretKey).update(payload).digest('hex'), 'utf8');
        const givenSig = Buffer.from(sig, 'utf8');
        if (givenSig.length !== expectedSig.length || !timingSafeEqual(givenSig, expectedSig)) {
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
    // Per-account cap: the route throttle is per IP, which rotating addresses defeats.
    await this.twoFactorAttempts?.assertNotLocked(body.userId);
    const valid = this.totp.verifyToken(body.token, secret);
    if (!valid) {
      const backupValid = await this.totp.verifyBackupCode(body.userId, body.token);
      if (!backupValid) {
        await this.twoFactorAttempts?.recordFailure(body.userId);
        throw new UnauthorizedException('Invalid verification code');
      }
    }
    await this.twoFactorAttempts?.reset(body.userId);

    const u = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, body.userId) });
    if (!u) throw new UnauthorizedException('User not found');
    if (u.accountStatus === 'deleted' || u.accountStatus === 'suspended') {
      throw new UnauthorizedException('Account is not accessible');
    }

    /**
     * The tokens must come from whichever authority owns credentials: with Supabase
     * auth enabled a first-party JWT is rejected by `JwtAuthGuard` on the very next
     * request, so completing 2FA used to leave the browser holding a cookie that could
     * never authenticate anything.
     */
    const session = await this.auth.issueSessionForUserId(u.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.cookieService.setAuthCookies(reply, session.accessToken, session.refreshToken, !!body.rememberDevice);
    this.cookieService.clearPending2faCookie(reply);

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
  @Throttle(TWO_FACTOR_THROTTLE)
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
    // Unconfigured: Google/GitHub would show their own "invalid client" page for `client_id=missing`.
    if (!isProviderConfigured(this.config, 'google')) {
      return reply.redirect(oauthFailureUrl(process.env.FRONTEND_URL || 'http://localhost:3000', 'unavailable'), 302);
    }
    return reply.redirect(providerAuthorizeUrl(this.config, 'google', state, callbackOrigin(this.config)), 302);
  }

  @Public()
  @Get('oauth/google/callback')
  @ApiOperation({ summary: 'Google OAuth callback — sets cookies and redirects to the app' })
  @UseFilters(OauthFailureFilter)
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: any,
    @Query('state') state: string | undefined,
    @Res() reply: any,
  ) {
    return this.finishOauth(req, reply, 'google', state, req.user);
  }

  @Public()
  @Get('oauth/github')
  @ApiOperation({ summary: 'GitHub OAuth login' })
  async githubAuth(@Query('state') state: string | undefined, @Res() reply: any) {
    // Unconfigured: Google/GitHub would show their own "invalid client" page for `client_id=missing`.
    if (!isProviderConfigured(this.config, 'github')) {
      return reply.redirect(oauthFailureUrl(process.env.FRONTEND_URL || 'http://localhost:3000', 'unavailable'), 302);
    }
    return reply.redirect(providerAuthorizeUrl(this.config, 'github', state, callbackOrigin(this.config)), 302);
  }

  @Public()
  @Get('oauth/github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback — sets cookies and redirects to the app' })
  @UseFilters(OauthFailureFilter)
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: any,
    @Query('state') state: string | undefined,
    @Res() reply: any,
  ) {
    return this.finishOauth(req, reply, 'github', state, req.user);
  }

  /**
   * Both OAuth callbacks take a bare `@Res()`, not `@Res({ passthrough: true })`.
   *
   * With passthrough Nest still owns the reply, so after this method redirected the
   * browser with `reply.redirect()` and returned `undefined`, Nest sent the return
   * value too and production logged
   * `FastifyError: Reply was already sent, did you forget to "return reply"` from the
   * callback route on every successful Google sign-in. Owning the reply here means the
   * handler sends exactly one response.
   */
  private async finishOauth(req: any, reply: any, provider: 'google' | 'github', state: string | undefined, profile: any) {
    const stateInfo = await this.consumeOauthState(state);
    // Enforce state validation (CSRF on OAuth)
    if (!stateInfo && process.env.OAUTH_REQUIRE_STATE !== 'false') {
      throw new (await import('@nestjs/common')).UnauthorizedException('Invalid or missing OAuth state');
    }

    /**
     * The provider's assertion about the mailbox is the only thing standing between a
     * sign-in and a provisioned identity, so an unverified address stops here rather
     * than becoming an account.
     */
    if (!profile?.email || profile.emailVerified !== true) {
      throw new (await import('@nestjs/common')).UnauthorizedException(
        `${provider} did not provide a verified email address`,
      );
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
      /**
       * Not swallowed: these cookies ARE the session, so a failure here produced a
       * redirect to `/auth/callback` that then reported "could not complete sign-in"
       * with nothing in the logs to explain it.
       */
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, false);
    }
    // Dual-write: JSON for old clients, 302 redirect target for browsers
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wantsRedirect = String(req.query?.redirect || '') === '1' || (req.headers?.accept || '').includes('text/html');
    if (wantsRedirect) {
      const target = new URL(result.twoFactorRequired ? '/2fa/verify' : '/auth/callback', frontend);
      target.searchParams.set('provider', provider);
      if (result.twoFactorRequired && result.user?.id) target.searchParams.set('userId', result.user.id);
      // Re-checked on the way out: rows written before the check was added may still hold a URL.
      const returnTo = safeRedirectPath(stateInfo?.redirectTo);
      if (returnTo) target.searchParams.set('returnTo', returnTo);
      return reply.status(302).redirect(target.toString());
    }
    return reply.send(result);
  }

  @Get('oauth/accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List linked OAuth accounts' })
  async getOAuthAccounts(@CurrentUser() user: any) {
    return this.auth.oauth.findAccountsByUser(user.id);
  }

  /**
   * `POST /auth/oauth/link` was removed. It linked whatever `{provider, providerAccountId}`
   * the body named with no proof of owning that identity, and `loginWithOauth` trusts the
   * link — so linking a victim's public GitHub id took over the victim's next OAuth sign-in.
   * Accounts are linked only by `loginWithOauth`, after the provider's own callback.
   */

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
