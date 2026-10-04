import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { eq } from 'drizzle-orm';
import { users } from '../../../database/schema/users';
import { RbacService } from '../../rbac/rbac.service';
import { SupabaseTokenVerifier } from '../supabase-token.verifier';

/**
 * Accepts a Supabase-issued access token and resolves the matching application user.
 *
 * This is the bridge for Phase 2. Two deliberate properties:
 *
 *  1. It populates `request.user` with the SAME shape `JwtStrategy` produces, so all
 *     144 `@CurrentUser()` sites, the RBAC guards and the tenant guards keep working
 *     unchanged. Supabase answers "who is this?"; everything downstream stays ours.
 *
 *  2. The tenant is NOT read from the token. A Supabase claim would be a second source
 *     of truth that goes stale on tenant switch, so `TenantResolveGuard` continues to
 *     resolve it from `x-tenant-slug` exactly as before.
 *
 * Inactive unless SUPABASE_AUTH_ENABLED=true, so it is inert until deliberately turned on.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(SupabaseTokenVerifier) private readonly verifier: SupabaseTokenVerifier,
    @Inject(DrizzleService) private readonly drizzle: DrizzleService,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.verifier.enabled) return false;

    const request = context.switchToHttp().getRequest();

    /**
     * Read the token from the Authorization header OR the httpOnly cookie, matching
     * JwtStrategy's extraction. The browser holds the Supabase token in a cookie
     * (credentials: 'include'), so header-only extraction rejected every session.
     */
    const header = request.headers?.authorization;
    const fromHeader = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const cookies = request.cookies ?? {};
    const fromCookie =
      cookies['access-token'] || cookies['__Host-access'] || cookies['__Host-access-token'] || null;
    const token = fromHeader || fromCookie;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const claims = await this.verifier.verify(token);

    // An anonymous Supabase session is not an application identity.
    if (claims.is_anonymous) throw new UnauthorizedException('Anonymous sessions are not accepted');

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.authUserId, claims.sub),
    });
    if (!user) {
      throw new UnauthorizedException('No application user is linked to this identity');
    }
    if (user.accountStatus === 'deleted') throw new UnauthorizedException('Account is deleted');

    // RBAC stays in this application: resolve the same permission set the local JWT
    // strategy would, from our own roles/permissions tables. A Supabase claim is never
    // treated as a grant. Without this every @Permissions() route would 403.
    let permissions: string[] = [];
    try {
      permissions = await this.rbac.resolvePermissions(user.id, user.role, user.tenantId);
    } catch {
      permissions = [];
    }

    // Identical field set to JwtStrategy.validate(), so downstream code cannot tell
    // the difference and no call site needs to branch on the token issuer.
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      tenantId: user.tenantId,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      twoFactorEnabled: user.twoFactorEnabled,
      impersonating: false,
      impersonatedBy: undefined,
      permissions,
    };

    return true;
  }
}