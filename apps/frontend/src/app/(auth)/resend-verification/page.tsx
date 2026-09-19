'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
export default function ResendVerificationPage() {
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resendVerification(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex h-full flex-col justify-center">
      {' '}
      <div className="mb-6">
        {' '}
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]">
          {' '}
          Verification{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#e8e8e8]">
          {' '}
          Resend Verification{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-[#8b8f96]">
          {' '}
          {sent
            ? 'If the email exists, a new verification link has been sent.'
            : 'Enter your email to receive a new verification link.'}{' '}
        </p>{' '}
      </div>{' '}
      {!sent && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {' '}
          <div className="space-y-1">
            {' '}
            <label
              htmlFor="email"
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]"
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
              autoFocus
              className="h-12 w-full rounded-xl border border-[#2a2e36] bg-[#16181c] px-4 text-sm text-[#e8e8e8] outline-none ring-0 transition-all duration-200 placeholder:text-[#5c6068] focus:border-[#f59e0b]/60 focus:ring-1 focus:ring-[#f59e0b]/30"
            />{' '}
          </div>{' '}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706] disabled:opacity-50"
          >
            {' '}
            {loading ? 'Sending...' : 'Send Verification Link'}{' '}
          </button>{' '}
        </form>
      )}{' '}
      {sent && (
        <button
          onClick={() => (window.location.href = '/login')}
          className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706]"
        >
          {' '}
          Back to Sign In{' '}
        </button>
      )}{' '}
      {!sent && (
        <p className="mt-6 text-center text-sm text-[#5c6068]">
          {' '}
          <Link
            href="/login"
            className="font-bold text-[#f59e0b] transition-all duration-200 hover:text-[#d97706]"
          >
            Back to Sign In
          </Link>{' '}
        </p>
      )}{' '}
    </div>
  );
}
