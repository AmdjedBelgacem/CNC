import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';
type FastifyReplyLike = { setCookie: (name: string, value: string, opts?: Record<string, unknown>) => unknown; clearCookie: (name: string, opts?: Record<string, unknown>) => unknown };

@Injectable()
export class CookieService {
  constructor(private config: ConfigService) {}

  private isProd(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  getAccessCookieName(): string {
    return this.isProd() ? '__Host-access' : 'access-token';
  }

  getRefreshCookieName(): string {
    return this.isProd() ? '__Host-refresh' : 'refresh-token';
  }

  getCsrfCookieName(): string {
    return 'csrf-token';
  }

  getPending2faCookieName(): string {
    return 'pending-2fa';
  }

  getImpersonationFlagName(): string {
    return 'impersonation';
  }

  setAuthCookies(
    reply: FastifyReplyLike,
    accessToken: string,
    refreshToken: string,
    rememberDevice = false,
  ): void {
    const isProd = this.isProd();
    const accessName = this.getAccessCookieName();
    const refreshName = this.getRefreshCookieName();

    // Access token: 15m, httpOnly, Secure in prod, Lax, Path=/
    reply.setCookie(accessName, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    // Refresh token: 7d or 30d, httpOnly, Secure, Lax.
    // Path=/ so it reaches POST /api/proxy/auth/refresh on the app origin
    // (and __Host- in production requires Path=/ anyway).
    const refreshMaxAge = rememberDevice ? 30 * 86400 : 7 * 86400;
    reply.setCookie(refreshName, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: refreshMaxAge,
    });
  }

  setCsrfCookie(reply: FastifyReplyLike, token: string): void {
    const isProd = this.isProd();
    reply.setCookie(this.getCsrfCookieName(), token, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }

  setPending2faCookie(reply: FastifyReplyLike, token: string): void {
    const isProd = this.isProd();
    reply.setCookie(this.getPending2faCookieName(), token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/', // must match POST /auth/2fa/verify
      maxAge: 5 * 60, // 5 minutes
    });
  }

  clearPending2faCookie(reply: FastifyReplyLike): void {
    reply.clearCookie(this.getPending2faCookieName(), { path: '/' });
  }

  setImpersonationFlag(reply: FastifyReplyLike): void {
    const isProd = this.isProd();
    reply.setCookie(this.getImpersonationFlagName(), '1', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
  }

  clearImpersonationFlag(reply: FastifyReplyLike): void {
    reply.clearCookie(this.getImpersonationFlagName(), { path: '/' });
  }

  clearAuthCookies(reply: FastifyReplyLike): void {
    const accessName = this.getAccessCookieName();
    const refreshName = this.getRefreshCookieName();

    reply.clearCookie(accessName, { path: '/' });
    reply.clearCookie(refreshName, { path: '/' });
    reply.clearCookie(this.getCsrfCookieName(), { path: '/' });
    this.clearPending2faCookie(reply);
    // Legacy-name cleanup during migration window
    reply.clearCookie('access-token', { path: '/' });
    reply.clearCookie('refresh-token', { path: '/' });
    reply.clearCookie('__Host-access', { path: '/' });
    reply.clearCookie('__Host-refresh', { path: '/' });
  }

  clearAccessCookie(reply: FastifyReplyLike): void {
    const accessName = this.getAccessCookieName();
    reply.clearCookie(accessName, { path: '/' });
    reply.clearCookie('access-token', { path: '/' });
    if (this.isProd()) {
      reply.clearCookie('__Host-access', { path: '/' });
    }
  }
}
