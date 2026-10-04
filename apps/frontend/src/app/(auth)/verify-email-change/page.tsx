'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
function VerifyEmailChangeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }
    fetch('/api/proxy/auth/change-email/confirm', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email address changed successfully.');
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to verify email change.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please try again.');
      });
  }, [token]);
  return (
    <Card className="w-full max-w-md border-border bg-card">
      {' '}
      <CardHeader className="text-center">
        {' '}
        <CardTitle className="text-xl text-white">Email Change Verification</CardTitle>{' '}
        <CardDescription>Confirming your new email address</CardDescription>{' '}
      </CardHeader>{' '}
      <CardContent className="flex flex-col items-center gap-4 pb-8 text-center">
        {' '}
        {status === 'loading' && (
          <>
            {' '}
            <Loader2 className="h-12 w-12 animate-spin text-primary" />{' '}
            <p className="text-sm text-muted-foreground">Verifying your email change...</p>{' '}
          </>
        )}{' '}
        {status === 'success' && (
          <>
            {' '}
            <CheckCircle2 className="h-12 w-12 text-success" />{' '}
            <p className="text-sm text-muted-foreground">{message}</p>{' '}
            <Button asChild className="mt-2 bg-primary text-black hover:bg-primary/90">
              {' '}
              <Link href="/login">Sign In</Link>{' '}
            </Button>{' '}
          </>
        )}{' '}
        {status === 'error' && (
          <>
            {' '}
            <XCircle className="h-12 w-12 text-red-500" />{' '}
            <p className="text-sm text-muted-foreground">{message}</p>{' '}
            <Button asChild variant="outline" className="mt-2">
              {' '}
              <Link href="/settings/account/security">Back to Security Settings</Link>{' '}
            </Button>{' '}
          </>
        )}{' '}
      </CardContent>{' '}
    </Card>
  );
}
export default function VerifyEmailChangePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {' '}
      <Suspense
        fallback={
          <Card className="w-full max-w-md border-border bg-card">
            {' '}
            <CardContent className="flex items-center justify-center py-12">
              {' '}
              <Loader2 className="size-8 animate-spin text-primary" />{' '}
            </CardContent>{' '}
          </Card>
        }
      >
        {' '}
        <VerifyEmailChangeInner />{' '}
      </Suspense>{' '}
    </div>
  );
}
