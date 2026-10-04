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
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            {' '}
            <svg className="h-7 w-7 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
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
          <h1 className="font-display text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
            {' '}
            Verifying...{' '}
          </h1>{' '}
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {' '}
            Please wait while we verify your email{' '}
          </p>{' '}
        </>
      )}{' '}
      {status === 'success' && (
        <>
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
            Email Verified!{' '}
          </h1>{' '}
          <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
            {' '}
            Your email has been verified. Redirecting to sign in...{' '}
          </p>{' '}
          <button
            onClick={() => router.push('/login')}
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
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
              className="h-7 w-7 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {' '}
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />{' '}
            </svg>{' '}
          </div>{' '}
          <h1 className="font-display text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
            {' '}
            Verification Failed{' '}
          </h1>{' '}
          <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>{' '}
          <div className="w-full space-y-2.5">
            {' '}
            <button
              onClick={() => router.push('/login')}
              className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
            >
              {' '}
              Go to Sign In{' '}
            </button>{' '}
            <button
              onClick={() => router.push('/resend-verification')}
              className="h-[44px] w-full rounded-xl border border-border bg-transparent text-13 font-semibold text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:text-primary"
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
          <p className="text-sm text-muted-foreground">Loading...</p>{' '}
        </div>
      }
    >
      {' '}
      <VerifyEmailContent />{' '}
    </Suspense>
  );
}
