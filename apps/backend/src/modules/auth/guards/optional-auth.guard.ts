import { Injectable, ExecutionContext, Inject, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseTokenVerifier } from '../supabase-token.verifier';

/**
 * Resolves the caller when there is one, and lets the request through either way.
 *
 * It must accept the same tokens as `JwtAuthGuard`. With Supabase auth on, every access token
 * is a Supabase token, and the first-party `jwt` strategy alone rejects all of them: the
 * session probe (`/auth/session`) then answered "signed out" straight after a successful
 * sign-in, the client refreshed, asked again, got the same answer and sent the admin back
 * to /login.
 *
 * The Supabase dependencies are optional because this guard is also used in modules that do
 * not import AuthModule; there it behaves exactly as before.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Optional() @Inject(SupabaseTokenVerifier) private readonly supabaseVerifier?: SupabaseTokenVerifier,
    @Optional() @Inject(SupabaseAuthGuard) private readonly supabaseGuard?: SupabaseAuthGuard,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.supabaseVerifier?.enabled && this.supabaseGuard) {
      try {
        await this.supabaseGuard.canActivate(context);
      } catch {
        // No token, an expired one or an unlinked identity: an anonymous caller, not an error.
      }
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }

  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
