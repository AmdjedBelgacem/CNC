'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { trackLogin } from '@/lib/analytics';

// OAuth: fetch a CSRF state from the backend, then redirect with redirect=1
// so the callback sets httpOnly cookies and redirects back to the app.
async function oauthRedirect(provider: 'google' | 'github') {
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
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
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
      router.push(returnUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
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
    } catch {
      setError('Failed to send verification email. Try again later.');
    } finally {
      setResending(false);
    }
  };
  return (
    <div className="flex h-full flex-col justify-center">
      {' '}
      <div className="mb-6">
        {' '}
        <p className="mb-1.5 text-2xs font-bold uppercase tracking-[0.15em] text-primary">
          {' '}
          Operator Sign In{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          Sign In{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {' '}
          Access your CNC manufacturing academy{' '}
        </p>{' '}
      </div>{' '}
      <form onSubmit={handleSubmit} className="space-y-4">
        {' '}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-destructive">
            {' '}
            {error}{' '}
            {needsVerification && !verificationSent && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="ms-1.5 font-bold text-primary underline underline-offset-2 transition-all duration-200 hover:text-primary/80"
              >
                {' '}
                {resending ? 'Sending...' : 'Resend verification email'}{' '}
              </button>
            )}{' '}
            {verificationSent && (
              <span className="ms-1.5 font-bold text-success"> Verification email sent! </span>
            )}{' '}
          </div>
        )}{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="email"
            className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            Email{' '}
          </label>{' '}
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <div className="space-y-1">
          {' '}
          <div className="flex items-center justify-between">
            {' '}
            <label
              htmlFor="password"
              className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
            >
              {' '}
              Password{' '}
            </label>{' '}
            <Link
              href="/forgot-password"
              className="text-2xs font-medium text-primary transition-all duration-200 hover:text-primary/80"
            >
              {' '}
              Forgot?{' '}
            </Link>{' '}
          </div>{' '}
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <label className="flex cursor-pointer items-center gap-2.5 transition-all duration-200 hover:opacity-80">
          {' '}
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="size-4 rounded border-border bg-background text-primary accent-primary"
          />{' '}
          <span className="text-xs font-medium text-muted-foreground">
            Remember this device for 30 days
          </span>{' '}
        </label>{' '}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
        >
          {' '}
          {loading ? 'Signing in...' : 'Sign In'}{' '}
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
            Or continue with{' '}
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
        <button
          type="button"
          onClick={() => {
            void oauthRedirect('github');
          }}
          className="h-11 w-full rounded-md border border-border bg-card text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-foreground"
        >
          {' '}
          <span className="flex items-center justify-center gap-3">
            {' '}
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              {' '}
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />{' '}
            </svg>{' '}
            GitHub{' '}
          </span>{' '}
        </button>{' '}
      </div>{' '}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {' '}
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
        >
          {' '}
          Sign up{' '}
        </Link>{' '}
      </p>{' '}
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      {' '}
      <LoginForm />{' '}
    </Suspense>
  );
}
