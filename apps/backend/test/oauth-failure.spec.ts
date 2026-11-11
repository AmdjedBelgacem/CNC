import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { oauthFailureReason, oauthFailureUrl } from '../src/modules/auth/strategies/oauth-failure.filter';
import { isProviderConfigured } from '../src/modules/auth/strategies/provider-authorize-url';

describe('a failed OAuth sign-in sends the person back to the login screen with a reason', () => {
  it('names the reason from the provider query or the error', () => {
    expect(oauthFailureReason(new Error('x'), { error: 'access_denied' })).toBe('denied');
    expect(oauthFailureReason(new UnauthorizedException('Invalid or missing OAuth state'))).toBe('invalid_state');
    expect(oauthFailureReason(new UnauthorizedException('google did not provide a verified email address'))).toBe('unverified_email');
    expect(oauthFailureReason(new Error('Failed to obtain access token'))).toBe('failed');
  });

  it('builds a login URL the page understands, and never leaks the underlying error', () => {
    expect(oauthFailureUrl('https://example.com', 'denied')).toBe('https://example.com/login?error=oauth_denied');
    expect(oauthFailureUrl('https://example.com', 'unavailable')).toBe('https://example.com/login?error=oauth_unavailable');
  });

  it('treats a provider with no credentials as unconfigured', () => {
    const config = (id?: string) => ({ get: () => id }) as never;
    expect(isProviderConfigured(config(undefined), 'google')).toBe(false);
    expect(isProviderConfigured(config(''), 'google')).toBe(false);
    expect(isProviderConfigured(config('missing'), 'github')).toBe(false);
    expect(isProviderConfigured(config('abc123.apps.googleusercontent.com'), 'google')).toBe(true);
  });
});
