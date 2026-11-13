'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { probeSession } from '@/lib/session-probe';
import { renewSessionEarly, sessionRenewalDue } from '@/lib/api-client';

/**
 * Restores the client session on app load.
 *
 * Asks GET /auth/session, which answers 200 whether or not anybody is signed in, so an
 * anonymous visitor makes one request that does not fail. When the access cookie has expired
 * but a refresh cookie is still live, the answer says so and the probe rotates the session
 * once before deciding. Nothing here relies on a 401, so nothing is logged as an error.
 *
 * Marks the store hydrated either way so `hasHydrated` gates (nav menus, admin gate) can
 * render correctly.
 *
 * The retry covers a transport failure only (a network blip, a 5xx), never an anonymous
 * answer: one attempt that fails reads as "signed out" and would bounce the user to /login
 * mid-session, so a failure is retried once before the session is treated as gone.
 */
const HYDRATION_RETRY_DELAY_MS = 700;

/** How often a signed-in page checks whether the session is due for an early renewal. */
const RENEWAL_CHECK_MS = 60 * 1000;

/**
 * While someone is signed in, renew the session before its 15-minute access cookie lapses
 * (see `renewSessionEarly`). Checked every minute and whenever the tab comes back, since a
 * background tab's timers are throttled and a laptop may have slept past the window.
 */
function useEarlySessionRenewal(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    const tick = () => {
      if (sessionRenewalDue()) void renewSessionEarly();
    };
    const id = window.setInterval(tick, RENEWAL_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn]);
}

export function AuthHydration({ children }: { children?: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const [done, setDone] = useState(false);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  useEarlySessionRenewal(signedIn);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Four tries with a growing delay: a rate-limited or restarting server must not read as a
      // sign-out on the first page an admin opens.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const user = await probeSession();
          if (cancelled) return;
          setUser(user && user.id ? (user as never) : null);
          setHydrated(true);
          break;
        } catch {
          if (cancelled) return;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, HYDRATION_RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }
          // Both attempts failed — treat as genuinely unauthenticated.
          setUser(null);
          setHydrated(true);
        }
      }
      if (!cancelled) setDone(true);
    })();

    // Re-check when the tab returns to the foreground, so a session ended elsewhere shows up.
    const revalidate = async () => {
      try {
        const user = await probeSession();
        setUser(user && user.id ? (user as never) : null);
      } catch {
        // A transport failure says nothing about the session; keep what we have.
      }
      setHydrated(true);
    };
    const onFocus = () => void revalidate();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void revalidate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [setUser, setHydrated]);

  return (
    <>
      {children}
      <span data-auth-hydrated={done ? 'true' : 'false'} hidden />
    </>
  );
}
