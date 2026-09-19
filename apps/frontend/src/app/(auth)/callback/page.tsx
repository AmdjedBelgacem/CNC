'use client';
import { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      const provider = params.get('provider') || 'oauth';
      const twoFactorRequired = params.get('twoFactor') === '1';
      const userId = params.get('userId');
      const returnTo = params.get('returnTo') || '/'; // Cookies are already set by the backend callback redirect.
if (twoFactorRequired && userId) {
        router.replace(`/2fa/verify?userId=${encodeURIComponent(userId)}`);
        return;
      }
      try {
        const user = await api.get<any>('/auth/me');
        setUser(user);
        router.replace(returnTo);
      } catch {
        setError(`Could not complete ${provider} sign-in. Please try again.`);
        setTimeout(() => router.replace('/login'), 2500);
      }
    })();
  }, [params, router, setUser]);
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        {' '}
        <p className="text-sm font-medium text-red-600">{error}</p>{' '}
      </div>
    );
  }
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      {' '}
      <Loader2 className="h-5 w-5 animate-spin" />{' '}
      <p className="text-sm">Completing sign-in…</p>{' '}
    </div>
  );
}
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          {' '}
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />{' '}
        </div>
      }
    >
      {' '}
      <CallbackInner />{' '}
    </Suspense>
  );
}
