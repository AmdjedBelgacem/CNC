'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [token, verifyEmail, router]);
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {' '}
      {status === 'verifying' && (
        <>
          {' '}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10">
            {' '}
            <svg className="h-7 w-7 animate-spin text-[#f59e0b]" fill="none" viewBox="0 0 24 24">
              {' '}
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />{' '}
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />{' '}
            </svg>{' '}
          </div>{' '}
          <h1 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#e8e8e8]">
            {' '}
            Verifying...{' '}
          </h1>{' '}
          <p className="mt-3 text-sm leading-relaxed text-[#8b8f96]">
            {' '}
            Please wait while we verify your email{' '}
          </p>{' '}
        </>
      )}{' '}
      {status === 'success' && (
        <>
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
            Email Verified!{' '}
          </h1>{' '}
          <p className="mb-6 mt-3 text-sm leading-relaxed text-[#8b8f96]">
            {' '}
            Your email has been verified. Redirecting to sign in...{' '}
          </p>{' '}
          <button
            onClick={() => router.push('/login')}
            className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706]"
          >
            {' '}
            Go to Sign In{' '}
          </button>{' '}
        </>
      )}{' '}
      {status === 'error' && (
        <>
          {' '}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/60 bg-red-950/40">
            {' '}
            <svg
              className="h-7 w-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {' '}
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />{' '}
            </svg>{' '}
          </div>{' '}
          <h1 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#e8e8e8]">
            {' '}
            Verification Failed{' '}
          </h1>{' '}
          <p className="mb-6 mt-3 text-sm leading-relaxed text-[#8b8f96]">{message}</p>{' '}
          <div className="w-full space-y-2.5">
            {' '}
            <button
              onClick={() => router.push('/login')}
              className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706]"
            >
              {' '}
              Go to Sign In{' '}
            </button>{' '}
            <button
              onClick={() => router.push('/resend-verification')}
              className="h-[44px] w-full rounded-xl border border-[#2a2e36] bg-transparent text-[13px] font-semibold text-[#8b8f96] transition-all duration-200 hover:border-[#f59e0b]/40 hover:text-[#f59e0b]"
            >
              {' '}
              Resend Verification{' '}
            </button>{' '}
          </div>{' '}
        </>
      )}{' '}
    </div>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center">
          {' '}
          <p className="text-sm text-[#5c6068]">Loading...</p>{' '}
        </div>
      }
    >
      {' '}
      <VerifyEmailContent />{' '}
    </Suspense>
  );
}
