import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfService } from '../services/csrf.service';

export const CSRF_SKIP_KEY = 'csrf_skip';
export const CSRF_REQUIRE_KEY = 'csrf_require';

/** Opt a route OUT of CSRF (e.g. Stripe webhooks, OAuth callbacks). */
export function SkipCsrf() {
  return (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CSRF_SKIP_KEY, true, descriptor.value);
  };
}

/** Opt a route IN to CSRF even when no ambient cookie is present (e.g. login/register). */
export function RequireCsrf() {
  return (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CSRF_REQUIRE_KEY, true, descriptor.value);
  };
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Double-submit-cookie CSRF protection.
 *
 * Registered GLOBALLY (app.module.ts) so every state-changing route is covered, not just
 * the two that used to carry `@UseGuards(CsrfGuard)`.
 *
 * Enforcement rule — a request must present the double-submit token when there is an
 * ambient credential to abuse, i.e. when either an auth cookie or a CSRF cookie is
 * present. This means:
 *   - cookie-authenticated mutations  -> enforced (the real CSRF threat)
 *   - Bearer-only API clients         -> exempt (no ambient credential; immune to CSRF)
 *   - anonymous public POSTs          -> exempt unless the route is marked @RequireCsrf()
 *   - Stripe webhooks / OAuth returns -> @SkipCsrf()
 *
 * Deliberately NOT `@RequireCsrf()` on the session-bootstrap endpoints
 * (`POST /auth/login`, `POST /auth/register`): a caller has no session yet, so
 * demanding a double-submit token there only breaks non-browser clients while
 * adding nothing. The login-CSRF case that *does* matter — a logged-in browser
 * being tricked into re-authenticating as someone else — is already covered,
 * because the ambient `access-token` cookie is present and enforcement kicks in.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private csrf: CsrfService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(CSRF_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();
    if (SAFE_METHODS.includes(method)) return true;

    const hasAuthCookie = !!(
      req.cookies?.['access-token'] ||
      req.cookies?.['__Host-access'] ||
      req.cookies?.['__Host-access-token']
    );
    const csrfCookie = req.cookies?.['csrf-token'];
    const csrfHeader = req.headers?.['x-csrf-token'];
    const isBearer = !!req.headers?.authorization?.startsWith('Bearer ');

    // Bearer-only clients carry no ambient credential — CSRF does not apply to them.
    if (isBearer && !hasAuthCookie) return true;

    const explicitlyRequired = this.reflector.getAllAndOverride<boolean>(CSRF_REQUIRE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nothing ambient to abuse and the route did not opt in -> nothing to enforce.
    if (!hasAuthCookie && !csrfCookie && !explicitlyRequired) return true;

    if (!csrfCookie || !csrfHeader) {
      throw new HttpException('CSRF token missing', HttpStatus.FORBIDDEN);
    }

    if (csrfCookie !== csrfHeader) {
      throw new HttpException('CSRF token mismatch', HttpStatus.FORBIDDEN);
    }

    if (!this.csrf.validateToken(csrfCookie)) {
      throw new HttpException('Invalid CSRF token', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
