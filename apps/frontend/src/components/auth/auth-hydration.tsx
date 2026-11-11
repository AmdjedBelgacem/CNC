'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { probeSession } from '@/lib/session-probe';

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

export function AuthHydration({ children }: { children?: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const user = await probeSession();
          if (cancelled) return;
          setUser(user && user.id ? (user as never) : null);
          setHydrated(true);
          break;
        } catch {
          if (cancelled) return;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, HYDRATION_RETRY_DELAY_MS));
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
