'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
// `/cart` is intentionally public: the cart is local (persisted zustand) and guests
// must be able to review it. Sign-in happens at `/checkout`.
export const AUTH_ONLY_ROUTES = ['/account', '/checkout', '/notifications'];
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Narrow selector: subscribing to the whole store re-renders this guard on
  // every auth write, including ones that do not touch `isAuthenticated`.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated); // Cookie auth hydrates asynchronously (GET /auth/me) — wait for it before redirecting.
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!hydrated) return; // session restore in flight
    const isProtected = AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r));
    if (isProtected && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }
    setChecking(false);
  }, [isAuthenticated, hydrated, pathname, router]);
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        {' '}
        <div className="space-y-4 w-full max-w-md">
          {' '}
          <Skeleton className="h-8 w-3/4 mx-auto" /> <Skeleton className="h-4 w-1/2 mx-auto" />{' '}
          <Skeleton className="h-32 w-full" />{' '}
        </div>{' '}
      </div>
    );
  }
  return <>{children}</>;
}
