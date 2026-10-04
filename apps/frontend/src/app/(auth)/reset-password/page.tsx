'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.');
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
          Password Reset!{' '}
        </h1>{' '}
        <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
          {' '}
          Your password has been updated successfully.{' '}
        </p>{' '}
        <button
          onClick={() => router.push('/login')}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          {' '}
          Sign In with New Password{' '}
        </button>{' '}
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
          Security Credentials{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          Set New Password{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {' '}
          Enter your new password below{' '}
        </p>{' '}
      </div>{' '}
      <form onSubmit={handleSubmit} className="space-y-4">
        {' '}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-destructive">
            {' '}
            {error}{' '}
          </div>
        )}{' '}
        {!token && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-destructive">
            {' '}
            Invalid or missing reset token. Please request a new password reset link.{' '}
          </div>
        )}{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="password"
            className="text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            New Password{' '}
          </label>{' '}
          <input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
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
            Confirm New Password{' '}
          </label>{' '}
          <input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading || !token}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
        >
          {' '}
          {loading ? 'Resetting...' : 'Reset Password'}{' '}
        </button>{' '}
      </form>{' '}
    </div>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      {' '}
      <ResetPasswordForm />{' '}
    </Suspense>
  );
}
