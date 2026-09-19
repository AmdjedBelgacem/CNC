'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

/**
 * Restores the client session on app load by calling GET /auth/me.
 * With httpOnly cookie auth the cookie is sent automatically — no localStorage
 * tokens involved. Marks the store hydrated either way so `hasHydrated` gates
 * (nav menus, admin gate) can render correctly.
 *
 * One retry is deliberate. The access cookie lives 15 minutes, and a cold page load
 * after it expires has to rotate before /auth/me can succeed. If that rotation loses to
 * a transient failure — a blip, or a cookie that another tab is mid-way through
 * replacing — a single attempt reads as "signed out" and bounces the user to /login
 * mid-session. Retrying once after a short pause lets the rotation settle; only after
 * both attempts fail do we conclude the session is really gone.
 *
 * This is a safety net, not the fix. The bounce itself came from the refresh call
 * omitting its CSRF header on a cold load — see `csrfHeaderToken` in lib/api-client.ts.
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
          const user = await api.get<any>('/auth/me');
          if (!cancelled) setUser(user);
          break;
        } catch {
          if (cancelled) return;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, HYDRATION_RETRY_DELAY_MS));
            continue;
          }
          // Both attempts failed — treat as genuinely unauthenticated.
          setHydrated(true);
        }
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
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
