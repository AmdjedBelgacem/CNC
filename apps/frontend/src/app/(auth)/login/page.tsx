'use client';
import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { trackLogin } from '@/lib/analytics';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthSubmit,
  GoogleButton,
  authLinkClass,
} from '@/components/auth/auth-kit';

// OAuth: fetch a CSRF state from the backend, then redirect with redirect=1
// so the callback sets httpOnly cookies and redirects back to the app.
//
// The navigation MUST go through /api/proxy/*: that is the only route the Next app
// serves (apps/frontend/src/app/api/proxy/[...path]/route.ts). These lines used to
// point at /api/auth/oauth/*, which matches nothing — the browser got a bare 404
// before ever reaching Google, so sign-in appeared simply broken.
async function oauthRedirect(provider: 'google') {
  try {
    const res = await fetch('/api/proxy/auth/oauth/state', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data?.state) {
        window.location.href = `/api/proxy/auth/oauth/${provider}?state=${encodeURIComponent(data.state)}&redirect=1`;
        return;
      }
    }
  } catch {
    // Fall through to the direct navigation below.
  }
  // No state could be fetched: navigate directly, and the backend answers with its own error.
  window.location.href = `/api/proxy/auth/oauth/${provider}?redirect=1`;
}
function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
  // The OAuth callback sends the browser back here with a reason when sign-in did not complete.
  const oauthError = searchParams.get('error');
  useEffect(() => {
    const reasons: Record<string, string> = {
      oauth_denied: 'oauthDenied',
      oauth_invalid_state: 'oauthInvalidState',
      oauth_unverified_email: 'oauthUnverifiedEmail',
      oauth_failed: 'oauthFailed',
      oauth_unavailable: 'oauthUnavailable',
    };
    const key = oauthError ? reasons[oauthError] : undefined;
    if (key) setError(t(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthError]);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setVerificationSent(false);
    setLoading(true);
    try {
const result = await login(email, password, rememberDevice);
      if (result && (result as any).twoFactorRequired) {
        router.push(`/2fa/verify?userId=${(result as any).userId}`);
        return;
      }
      trackLogin('password');
      toast({ type: 'ok', title: t('signInTitle') });
      router.push(returnUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('loginFailed');
      setError(msg);
      toast({ type: 'err', title: t('loginFailed'), description: msg });
      if (msg === 'Please verify your email address before logging in.') {
        setNeedsVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };
  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification(email);
      setVerificationSent(true);
      toast({ type: 'ok', title: t('verification.sent') });
    } catch {
      setError(t('verification.sendFailed'));
      toast({ type: 'err', title: t('verification.sendFailed') });
    } finally {
      setResending(false);
    }
  };
  return (
    <div className="flex h-full flex-1 flex-col justify-center">
      <AuthHeading eyebrow={t('login.eyebrow')} title={t('signIn')} subtitle={t('login.subtitle')} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthAlert show={!!error}>
          {error}
          {needsVerification && !verificationSent && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className={cn('ms-1.5', authLinkClass)}
            >
              {resending ? t('sending') : t('verification.resendEmail')}
            </button>
          )}
          {verificationSent && (
            <span className="ms-1.5 font-medium text-success">{t('verification.sent')}</span>
          )}
        </AuthAlert>
        <AuthField id="email" label={t('email')}>
          <AuthInput
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            invalid={!!error}
          />
        </AuthField>
        <AuthField
          id="password"
          label={t('password')}
          aside={
            <Link href="/forgot-password" className={cn('text-[13px]', authLinkClass)}>
              {t('forgotLink')}
            </Link>
          }
        >
          <AuthInput
            id="password"
            type="password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            invalid={!!error}
          />
        </AuthField>
        <label className="flex w-fit cursor-pointer select-none items-center gap-2.5">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="size-4 rounded border-border bg-card text-primary accent-primary"
          />
          <span className="text-sm text-muted-foreground">{t('rememberDevice')}</span>
        </label>
        <AuthSubmit type="submit" disabled={loading} loading={loading}>
          {loading ? t('signingIn') : t('signIn')}
        </AuthSubmit>
      </form>
      <AuthDivider>{t('orContinueWith')}</AuthDivider>
      <GoogleButton
        onClick={() => {
          void oauthRedirect('google');
        }}
      />
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {t('dontHaveAccount')}{' '}
        <Link href="/register" className={authLinkClass}>
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
export default function LoginPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">{tCommon('loading')}</div>}>
      <LoginForm />
    </Suspense>
  );
}
