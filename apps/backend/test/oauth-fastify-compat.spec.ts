import { describe, expect, it } from 'vitest';
import { StatelessOAuthStateStore } from '../src/modules/auth/strategies/stateless-oauth-state.store';
import { callbackOrigin } from '../src/modules/auth/strategies/oauth-callback-url';
import { providerAuthorizeUrl } from '../src/modules/auth/strategies/provider-authorize-url';

const config = (over: Record<string, unknown> = {}) =>
  ({ get: (k: string) => (k in over ? over[k] : undefined) }) as never;

describe('StatelessOAuthStateStore', () => {
  // passport branches on these arities; changing them silently changes the call shape.
  it('exposes the arities passport-oauth2 dispatches on', () => {
    expect(new StatelessOAuthStateStore().store.length).toBe(3);
    expect(new StatelessOAuthStateStore().verify.length).toBe(4);
  });

  it('never throws for a missing req.session', () => {
    // NullStore.store() throws here, which produced a 500 on every connect attempt.
    expect(() =>
      new StatelessOAuthStateStore().store({}, {}, () => undefined),
    ).not.toThrow();
  });

  it('passes the caller state through to the provider untouched', () => {
    const state = 'a'.repeat(43);
    let seen: unknown;
    new StatelessOAuthStateStore().verify({}, state, {}, (_e, ok, info) => {
      expect(ok).toBe(true);
      seen = info;
    });
    expect(seen).toBe(state);
  });

  it('is stateless: two stores share nothing', () => {
    expect(new StatelessOAuthStateStore()).not.toBe(new StatelessOAuthStateStore());
  });
});

describe('callbackOrigin', () => {
  it('prefers the explicit public API url', () => {
    expect(callbackOrigin(config({ API_PUBLIC_URL: 'https://api.example.com/' }))).toBe('https://api.example.com');
  });

  it('never points at the frontend', () => {
    const origin = callbackOrigin(config({ FRONTEND_URL: 'https://app.example.com', PORT: 4000 }));
    expect(origin).not.toContain('app.example.com');
    expect(origin).toContain(':4000');
  });
});

describe('providerAuthorizeUrl', () => {
  it('builds a google authorize url with the api callback', () => {
    const url = new URL(
      providerAuthorizeUrl(config({ GOOGLE_CLIENT_ID: 'gid' }), 'google', 'st4te', 'https://api.example.com'),
    );
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('gid');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.com/auth/oauth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('email profile');
    expect(url.searchParams.get('state')).toBe('st4te');
  });

  it('builds a github authorize url with the api callback', () => {
    const url = new URL(
      providerAuthorizeUrl(config({ GITHUB_CLIENT_ID: 'ghid' }), 'github', 'st4te', 'https://api.example.com'),
    );
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe('/login/oauth/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.com/auth/oauth/github/callback');
    expect(url.searchParams.get('scope')).toBe('user:email');
  });

  it('omits state rather than sending an empty one', () => {
    const url = new URL(providerAuthorizeUrl(config({ GOOGLE_CLIENT_ID: 'g' }), 'google', undefined, 'https://a.co'));
    expect(url.searchParams.has('state')).toBe(false);
  });
});