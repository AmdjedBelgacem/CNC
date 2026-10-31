'use client';
import { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { Loader2, X } from 'lucide-react';
import { AuthStatus, AuthStatusIcon, AuthSteps } from '@/components/auth/auth-kit';
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
  return (
    <AuthSteps step={error ? 'error' : 'pending'}>
      {error ? (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="error">
              <X className="size-6" aria-hidden />
            </AuthStatusIcon>
          }
          title={<span role="alert">{error}</span>}
          className="min-h-[40vh]"
        />
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <span className="relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <Loader2 className="size-5 animate-spin" />
          </span>
          <p className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            Completing sign-in…
          </p>
        </div>
      )}
    </AuthSteps>
  );
}
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
