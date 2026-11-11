'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { meetsPasswordPolicy } from '@/lib/password-policy';
// OAuth: fetch a CSRF state from the backend, then redirect with redirect=1
import { trackSignUp } from '@/lib/analytics';
import { toast } from '@/components/ui/toast';
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthNote,
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  DrawnCheck,
  GoogleButton,
  authLinkClass,
} from '@/components/auth/auth-kit';
// so the callback sets httpOnly cookies and redirects back to the app.
// The navigation goes through /api/proxy/*, the only API route the Next app serves.
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
export default function RegisterPage() {
  const t = useTranslations('auth');
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    if (!meetsPasswordPolicy(form.password)) {
      setError(t('passwordPolicy'));
      return;
    }
    setLoading(true);
    try {
await register({
        email: form.email,
        password: form.password,
        name: form.name,
        username: form.username || undefined,
      });
      trackSignUp('password');
      setSuccess(true);
      toast({ type: 'ok', title: t('checkYourEmail') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('registrationFailed');
      setError(message);
      toast({ type: 'err', title: t('registrationFailed'), description: message });
    } finally {
      setLoading(false);
    }
  };
  const inputs = (
    field: 'name' | 'username' | 'email' | 'password' | 'confirmPassword',
  ): { id: string; value: string; onChange: ReturnType<typeof handleChange> } => ({
    id: field,
    value: form[field],
    onChange: handleChange(field),
  });
  return (
    <AuthSteps step={success ? 'sent' : 'form'}>
      {success ? (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="success">
              <DrawnCheck />
            </AuthStatusIcon>
          }
          title={t('checkYourEmail')}
        >
          <p className="mx-auto mb-7 mt-3 max-w-[360px] text-[15px] leading-relaxed text-muted-foreground">
            {t('verification.linkSentTo')} <strong className="font-medium text-foreground">{form.email}</strong>.
          </p>
          <AuthNote>
            {t('didntReceiveIt')}{' '}
            <Link href="/resend-verification" className={authLinkClass}>
              {t('requestNewLink')}
            </Link>
          </AuthNote>
          <p className="mt-7 text-sm text-muted-foreground">
            <Link href="/login" className={authLinkClass}>
              {t('goToSignIn')}
            </Link>
          </p>
        </AuthStatus>
      ) : (
        <div className="flex h-full flex-col justify-center">
          <AuthHeading
            eyebrow={t('register.eyebrow')}
            title={t('createAccount')}
            subtitle={t('register.subtitle')}
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthAlert show={!!error}>{error}</AuthAlert>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <AuthField id="name" label={t('fullName')}>
                <AuthInput {...inputs('name')} placeholder="John Doe" required autoFocus />
              </AuthField>
              <AuthField
                id="username"
                label={
                  <>
                    {t('username')}{' '}
                    <span className="font-normal text-muted-foreground">{t('optional')}</span>
                  </>
                }
              >
                <AuthInput {...inputs('username')} placeholder="johndoe" />
              </AuthField>
            </div>
            <AuthField id="email" label={t('email')}>
              <AuthInput
                {...inputs('email')}
                type="email"
                placeholder={t('emailPlaceholder')}
                required
                autoComplete="email"
              />
            </AuthField>
            <AuthField id="password" label={t('password')}>
              <AuthInput
                {...inputs('password')}
                type="password"
                placeholder={t('passwordRequirementsPlaceholder')}
                required
                autoComplete="new-password"
              />
            </AuthField>
            <AuthField id="confirmPassword" label={t('confirmPassword')}>
              <AuthInput
                {...inputs('confirmPassword')}
                type="password"
                placeholder={t('confirmPasswordPlaceholder')}
                required
                autoComplete="new-password"
                invalid={!!form.confirmPassword && form.confirmPassword !== form.password && !!error}
              />
            </AuthField>
            <div className="pt-1">
              <AuthSubmit type="submit" disabled={loading} loading={loading}>
                {loading ? t('creatingAccount') : t('createAccount')}
              </AuthSubmit>
            </div>
          </form>
          <AuthDivider>{t('orSignUpWith')}</AuthDivider>
          <GoogleButton
            onClick={() => {
              void oauthRedirect('google');
            }}
          />
          <p className="mt-7 text-center text-sm text-muted-foreground">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className={authLinkClass}>
              {t('signIn')}
            </Link>
          </p>
        </div>
      )}
    </AuthSteps>
  );
}
