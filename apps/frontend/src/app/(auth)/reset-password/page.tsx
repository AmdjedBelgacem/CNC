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
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-900/60 bg-emerald-950/40">
          {' '}
          <svg
            className="h-7 w-7 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {' '}
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />{' '}
          </svg>{' '}
        </div>{' '}
        <h1 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#e8e8e8]">
          {' '}
          Password Reset!{' '}
        </h1>{' '}
        <p className="mb-6 mt-3 text-sm leading-relaxed text-[#8b8f96]">
          {' '}
          Your password has been updated successfully.{' '}
        </p>{' '}
        <button
          onClick={() => router.push('/login')}
          className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706]"
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
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]">
          {' '}
          Security Credentials{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#e8e8e8]">
          {' '}
          Set New Password{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-[#8b8f96]">
          {' '}
          Enter your new password below{' '}
        </p>{' '}
      </div>{' '}
      <form onSubmit={handleSubmit} className="space-y-4">
        {' '}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">
            {' '}
            {error}{' '}
          </div>
        )}{' '}
        {!token && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">
            {' '}
            Invalid or missing reset token. Please request a new password reset link.{' '}
          </div>
        )}{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="password"
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]"
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
            className="h-12 w-full rounded-xl border border-[#2a2e36] bg-[#16181c] px-4 text-sm text-[#e8e8e8] outline-none ring-0 transition-all duration-200 placeholder:text-[#5c6068] focus:border-[#f59e0b]/60 focus:ring-1 focus:ring-[#f59e0b]/30"
          />{' '}
        </div>{' '}
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="confirmPassword"
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]"
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
            className="h-12 w-full rounded-xl border border-[#2a2e36] bg-[#16181c] px-4 text-sm text-[#e8e8e8] outline-none ring-0 transition-all duration-200 placeholder:text-[#5c6068] focus:border-[#f59e0b]/60 focus:ring-1 focus:ring-[#f59e0b]/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading || !token}
          className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706] active:scale-[0.99] disabled:opacity-50"
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
    <Suspense fallback={<div className="text-sm text-[#5c6068]">Loading...</div>}>
      {' '}
      <ResetPasswordForm />{' '}
    </Suspense>
  );
}
