import type { ConfigService } from '../../../config/config.service';

/**
 * Builds a provider authorize URL without passport.
 *
 * passport's `strategy.redirect()` calls `res.setHeader()` and `res.end()`, which are
 * Express-only. This app runs on Fastify (@nestjs/platform-fastify), whose reply
 * object has neither, so every `AuthGuard('google'|'github')` authorize hop died with
 * "TypeError: res.setHeader is not a function" before the handler ever ran. The
 * callback hop is unaffected because it resolves through `done()` instead.
 *
 * State is NOT generated here: the caller mints it with GET /auth/oauth/state so it is
 * persisted, and finishOauth validates it against that record. CSRF protection is
 * therefore unchanged.
 */
export function providerAuthorizeUrl(
  config: ConfigService,
  provider: 'google' | 'github',
  state: string | undefined,
  origin: string,
): string {
  const isGoogle = provider === 'google';
  const clientId = isGoogle ? config.get('GOOGLE_CLIENT_ID') : config.get('GITHUB_CLIENT_ID');
  const redirectUri = `${origin}/auth/oauth/${provider}/callback`;

  const url = new URL(
    isGoogle ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://github.com/login/oauth/authorize',
  );
  url.searchParams.set('client_id', String(clientId || 'missing'));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', isGoogle ? 'email profile' : 'user:email');
  if (state) url.searchParams.set('state', state);
  return url.toString();
}