'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminGenericSkeleton, adminSkeletonFor } from '@/components/skeletons/admin-route-skeletons';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';

const ADMIN_ROLES = ['super_admin', 'admin', 'instructor'];
type Status = 'checking' | 'ok' | 'denied' | 'anon';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Cookie auth hydrates asynchronously (GET /auth/me) — wait for it before
  // deciding, otherwise the gate bounces users to /login mid-restore.
  const hydrated = useAuthStore((s) => s.hydrated);
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!hydrated) return;
    // session restore in flight
    (async () => {
      if (!isAuthenticated) {
        if (!cancelled) setStatus('anon');
        return;
      }
      try {
        // api.get auto-refreshes expired tokens and re-syncs the access-token
        // cookie, so a stale cookie from a previous visit is fine here.
        const me = await api.get<{ role: string }>('/auth/me');
        if (!cancelled) setStatus(ADMIN_ROLES.includes(me.role) ? 'ok' : 'denied');
      } catch {
        if (!cancelled) setStatus(isAuthenticated ? 'denied' : 'anon');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hydrated]);

  useEffect(() => {
    if (status === 'anon') router.replace('/login?returnUrl=/admin');
    else if (status === 'denied') router.replace('/');
  }, [status, router]);

  if (status !== 'ok') {
    // The role check runs on every hard load. Show the page's own replica
    // meanwhile, so the wait reads as the page loading (and the layout is
    // already in place), instead of a centred "Checking admin access…" pill
    // that the page then replaces wholesale.
    return <>{adminSkeletonFor(pathname ?? '/admin') ?? <AdminGenericSkeleton />}</>;
  }
  return <>{children}</>;
}
