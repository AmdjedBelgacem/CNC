'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
function Verify2faForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const { verify2fa } = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2fa(userId, token);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex h-full flex-col justify-center">
      {' '}
      <div className="mb-6 text-center">
        {' '}
        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          {' '}
          <svg
            className="size-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {' '}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />{' '}
          </svg>{' '}
        </div>{' '}
        <p className="mb-1.5 text-2xs font-bold uppercase tracking-[0.15em] text-primary">
          {' '}
          Security Authentication{' '}
        </p>{' '}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {' '}
          {useRecovery
            ? 'Enter one of your recovery codes'
            : 'Enter the code from your authenticator app'}{' '}
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
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="token"
            className="block text-center text-2xs font-bold uppercase tracking-[0.15em] text-primary"
          >
            {' '}
            {useRecovery ? 'Recovery Code' : 'Authentication Code'}{' '}
          </label>{' '}
          <input
            id="token"
            type="text"
            inputMode={useRecovery ? 'text' : 'numeric'}
            placeholder={useRecovery ? 'XXXX-XXXXXX' : '000000'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            autoFocus
            maxLength={useRecovery ? 10 : 6}
            className="h-12 w-full rounded-xl border border-border bg-background text-center text-xl tracking-[0.3em] text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
        >
          {' '}
          {loading ? 'Verifying...' : 'Verify'}{' '}
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setToken('');
            setError('');
          }}
          className="w-full text-center text-2xs font-medium text-primary transition-all duration-200 hover:text-primary/80"
        >
          {' '}
          {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}{' '}
        </button>{' '}
      </form>{' '}
    </div>
  );
}
export default function Verify2faPage() {
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
      <Verify2faForm />{' '}
    </Suspense>
  );
}
