'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
// OAuth: fetch a CSRF state from the backend, then redirect with redirect=1
import { trackSignUp } from '@/lib/analytics';
// so the callback sets httpOnly cookies and redirects back to the app.
async function oauthRedirect(provider: 'google') {
  try {
    const res = await fetch('/api/proxy/auth/oauth/state', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data?.state) {
        window.location.href = `/api/auth/oauth/${provider}?state=${encodeURIComponent(data.state)}&redirect=1`;
        return;
      }
    }
  } catch {} // Fallback: direct navigation (backend may still accept, or shows error) window.location.href = `/api/auth/oauth/${provider}?redirect=1`;
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
    if (form.password.length < 8) {
      setError(t('passwordMinLength'));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  };
  if (success) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        {' '}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-success/60 bg-success/40">
          {' '}
          <svg
            className="h-7 w-7 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {' '}
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />{' '}
          </svg>{' '}
        </div>{' '}
        <h1 className="font-display text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          {t('checkYourEmail')}{' '}
        </h1>{' '}
        <p className="mx-auto mb-6 mt-3 max-w-[360px] text-sm leading-relaxed text-muted-foreground">
          {' '}
          {t('verification.linkSentTo')} <strong className="text-foreground">{form.email}</strong>.{' '}
        </p>{' '}
        <div className="w-full rounded-xl border border-border bg-background/50 p-3.5 text-xs text-muted-foreground">
          {' '}
          {t('didntReceiveIt')}{' '}
          <Link
            href="/resend-verification"
            className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
          >
            {t('requestNewLink')}
          </Link>{' '}
        </div>{' '}
        <p className="mt-6 text-sm text-muted-foreground">
          {' '}
          <Link
            href="/login"
            className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
          >
            {t('goToSignIn')}
          </Link>{' '}
        </p>{' '}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center">
      {' '}
      <div className="mb-6">
        {' '}
        <p className="mb-1.5 text-2xs font-bold uppercase tracking-[0.15em] text-primary">
          {' '}
          {t('register.eyebrow')}{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          {t('createAccount')}{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {' '}
          {t('register.subtitle')}{' '}
        </p>{' '}
      </div>{' '}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {' '}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-destructive">
            {' '}
            {error}{' '}
          </div>
        )}{' '}
        <div className="grid grid-cols-2 gap-3">
          {' '}
          <div className="space-y-1">
            {' '}
            <label
              htmlFor="name"
              className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
            >
              {' '}
              {t('fullName')}{' '}
            </label>{' '}
            <input
              id="name"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange('name')}
              required
              autoFocus
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
            />{' '}
          </div>{' '}
          <div className="space-y-1">
            {' '}
            <label
              htmlFor="username"
              className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
            >
              {' '}
              {t('username')}{' '}
              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                {t('optional')}
              </span>{' '}
            </label>{' '}
            <input
              id="username"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange('username')}
              className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
            />{' '}
          </div>{' '}
        </div>{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="email"
            className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            {t('email')}{' '}
          </label>{' '}
          <input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            value={form.email}
            onChange={handleChange('email')}
            required
            autoComplete="email"
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="password"
            className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            {t('password')}{' '}
          </label>{' '}
          <input
            id="password"
            type="password"
            placeholder={t('passwordRequirementsPlaceholder')}
            value={form.password}
            onChange={handleChange('password')}
            required
            autoComplete="new-password"
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="confirmPassword"
            className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            {t('confirmPassword')}{' '}
          </label>{' '}
          <input
            id="confirmPassword"
            type="password"
            placeholder={t('confirmPasswordPlaceholder')}
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            required
            autoComplete="new-password"
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
        >
          {' '}
          {loading ? t('creatingAccount') : t('createAccount')}{' '}
        </button>{' '}
      </form>{' '}
      <div className="relative my-8">
        {' '}
        <div className="absolute inset-0 flex items-center">
          {' '}
          <div className="w-full border-t border-border" />{' '}
        </div>{' '}
        <div className="relative flex justify-center">
          {' '}
          <span className="bg-card px-3 text-2xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            {' '}
            {t('orSignUpWith')}{' '}
          </span>{' '}
        </div>{' '}
      </div>{' '}
      <div className="space-y-2.5">
        {' '}
        <button
          type="button"
          onClick={() => {
            void oauthRedirect('google');
          }}
          className="h-11 w-full rounded-md border border-border bg-card text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-foreground"
        >
          {' '}
          <span className="flex items-center justify-center gap-3">
            {' '}
            <svg className="size-4" viewBox="0 0 24 24">
              {' '}
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />{' '}
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />{' '}
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />{' '}
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />{' '}
            </svg>{' '}
            Google{' '}
          </span>{' '}
        </button>{' '}
              </div>{' '}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {' '}
        {t('alreadyHaveAccount')}{' '}
        <Link
          href="/login"
          className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
        >
          {t('signIn')}
        </Link>{' '}
      </p>{' '}
    </div>
  );
}
