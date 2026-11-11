'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
// `/cart` is intentionally public: the cart is local (persisted zustand) and guests
// must be able to review it. Sign-in happens at `/checkout`.
export const AUTH_ONLY_ROUTES = ['/account', '/checkout', '/notifications', '/messages'];
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
      <div className="flex min-h-[60vh] items-center justify-center px-4" aria-busy="true">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-8 shadow-xs">
          <Skeleton className="mx-auto h-8 w-3/4 rounded-lg" />
          <Skeleton className="mx-auto h-4 w-1/2" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
