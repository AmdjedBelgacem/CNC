import { describe, expect, it } from 'vitest';
import { CookieService, REMEMBER_COOKIE } from '../src/modules/auth/services/cookie.service';

/**
 * A "Keep me signed in" session must keep its 30-day refresh cookie across token rotations.
 * Supabase rotations passed `false`, which cut every remembered sign-in to 7 days.
 */
function fakeReply() {
  const set: Record<string, { value: string; opts: any }> = {};
  const cleared: string[] = [];
  return {
    set,
    cleared,
    setCookie: (name: string, value: string, opts?: any) => {
      set[name] = { value, opts };
    },
    clearCookie: (name: string) => {
      cleared.push(name);
    },
  };
}

const service = new CookieService({ get: () => 'production' } as any);

describe('remember-me cookie', () => {
  it('marks a remembered session and gives its refresh cookie 30 days', () => {
    const reply = fakeReply();
    service.setAuthCookies(reply, 'a', 'r', true);
    expect(reply.set[REMEMBER_COOKIE]?.value).toBe('1');
    expect(reply.set['__Host-refresh'].opts.maxAge).toBe(30 * 86400);
  });

  it('a rotation that reads the flag keeps 30 days', () => {
    const reply = fakeReply();
    const remembered = service.isRememberedSession({ cookies: { [REMEMBER_COOKIE]: '1' } });
    service.setAuthCookies(reply, 'a2', 'r2', remembered);
    expect(remembered).toBe(true);
    expect(reply.set['__Host-refresh'].opts.maxAge).toBe(30 * 86400);
  });

  it('a session without the flag stays at 7 days and clears any stale flag', () => {
    const reply = fakeReply();
    service.setAuthCookies(reply, 'a', 'r', service.isRememberedSession({ cookies: {} }));
    expect(reply.set['__Host-refresh'].opts.maxAge).toBe(7 * 86400);
    expect(reply.cleared).toContain(REMEMBER_COOKIE);
  });

  it('sign-out clears the flag', () => {
    const reply = fakeReply();
    service.clearAuthCookies(reply);
    expect(reply.cleared).toContain(REMEMBER_COOKIE);
  });
});
