import { Injectable, ExecutionContext, UnauthorizedException, Inject, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseTokenVerifier } from '../supabase-token.verifier';

/**
 * Accepts either a first-party JWT or a Supabase-issued access token.
 *
 * The local JWT strategy remains primary so existing sessions keep working during the
 * Phase 2 transition. When Supabase auth is enabled and the local strategy yields no
 * user, the request is retried through SupabaseAuthGuard, which resolves the same
 * `request.user` shape. Tenancy and RBAC are unaffected either way — the guard only
 * decides *who* the caller is, never which tenant or what they may do.
 *
 * The Supabase dependencies are optional because this guard is also registered in
 * modules that do not import AuthModule (UploadModule and others). Where they are
 * absent, `supabaseAvailable` is false and the guard behaves exactly as before.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional() @Inject(SupabaseTokenVerifier) private readonly supabaseVerifier?: SupabaseTokenVerifier,
    @Optional() @Inject(SupabaseAuthGuard) private readonly supabaseGuard?: SupabaseAuthGuard,
  ) {
    super();
  }

  private get supabaseAvailable(): boolean {
    return !!this.supabaseVerifier?.enabled && !!this.supabaseGuard;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    /**
     * Supabase-exclusive mode: Supabase is the only token issuer, so validate against
     * its JWKS and never fall back to the first-party JWT strategy. Trying the local
     * strategy first would keep two valid token types alive, which is exactly what
     * "exclusive" is meant to eliminate.
     */
    if (this.supabaseAvailable) {
      return (await this.supabaseGuard!.canActivate(context)) as boolean;
    }

    return (await super.canActivate(context)) as boolean;
  }

  handleRequest(err: any, user: any, _info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}