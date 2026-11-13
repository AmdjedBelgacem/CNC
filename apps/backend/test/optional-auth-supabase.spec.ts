import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { OptionalAuthGuard } from '../src/modules/auth/guards/optional-auth.guard';

/**
 * With Supabase auth on, every access token is a Supabase token. The optional guard behind
 * /auth/session used only the first-party JWT strategy, so a freshly signed-in admin was
 * reported as signed out and bounced back to /login.
 */
function context(request: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('OptionalAuthGuard with Supabase auth on', () => {
  it('resolves the caller from a Supabase token', async () => {
    const request: Record<string, unknown> = { headers: {}, cookies: { 'access-token': 'sb' } };
    const supabaseGuard = {
      canActivate: async (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { id: 'admin-1' };
        return true;
      },
    };
    const guard = new OptionalAuthGuard({ enabled: true } as never, supabaseGuard as never);
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'admin-1' });
  });

  it('lets an anonymous or expired caller through with no user', async () => {
    const request: Record<string, unknown> = { headers: {}, cookies: {} };
    const supabaseGuard = {
      canActivate: async () => {
        throw new UnauthorizedException('Authentication required');
      },
    };
    const guard = new OptionalAuthGuard({ enabled: true } as never, supabaseGuard as never);
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
