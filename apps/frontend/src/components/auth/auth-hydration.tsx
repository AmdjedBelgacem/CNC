'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

/**
 * Restores the client session on app load.
 *
 * Asks GET /auth/session, which answers `{ authenticated: false }` with a 200 when nobody is
 * signed in. It used to ask `/auth/me`, where an anonymous visitor got a 401 — which the API
 * client then answered with a `/auth/refresh` that 401'd too. Two doomed requests and two
 * console errors on every public page load, to learn what the server already knew.
 *
 * Marks the store hydrated either way so `hasHydrated` gates (nav menus, admin gate) can
 * render correctly.
 *
 * The retry covers a genuine race, not the common case: the access cookie lives 15 minutes,
 * so a cold load after it expires has to rotate before the session resolves. If that rotation
 * loses to a blip, or to a cookie another tab is mid-way through replacing, one attempt reads
 * as "signed out" and bounces the user to /login mid-session. Retrying once lets it settle;
 * only after both attempts fail is the session really gone.
 */
const HYDRATION_RETRY_DELAY_MS = 700;

export function AuthHydration({ children }: { children?: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const [done, setDone] = useState(false);

  const revalidate = async () => {
    try {
      const user = await api.get<any>('/auth/me');
      if (user && user.id) setUser(user);
      else setUser(null);
      setHydrated(true);
    } catch {
      // 401 after refresh failure means genuinely signed out.
      setUser(null);
      setHydrated(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const user = await api.get<any>('/auth/me');
          if (cancelled) return;
          if (user && user.id) setUser(user);
          else {
            setUser(null);
          }
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
      {' '}
      {children} {/* Hidden marker for tests */}{' '}
      <span data-auth-hydrated={done ? 'true' : 'false'} hidden />{' '}
    </>
  );
}
