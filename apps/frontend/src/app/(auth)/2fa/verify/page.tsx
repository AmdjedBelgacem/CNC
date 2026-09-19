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
        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10">
          {' '}
          <svg
            className="h-6 w-6 text-[#f59e0b]"
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
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]">
          {' '}
          Security Authentication{' '}
        </p>{' '}
        <p className="text-sm leading-relaxed text-[#8b8f96]">
          {' '}
          {useRecovery
            ? 'Enter one of your recovery codes'
            : 'Enter the code from your authenticator app'}{' '}
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
        <div className="space-y-1">
          {' '}
          <label
            htmlFor="token"
            className="block text-center text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]"
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
            className="h-12 w-full rounded-xl border border-[#2a2e36] bg-[#16181c] text-center text-xl tracking-[0.3em] text-[#e8e8e8] outline-none ring-0 transition-all duration-200 placeholder:text-[#3d4148] focus:border-[#f59e0b]/60 focus:ring-1 focus:ring-[#f59e0b]/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-[#f59e0b] text-[13px] font-bold text-[#16181c] transition-all duration-200 hover:scale-[1.01] hover:bg-[#d97706] active:scale-[0.99] disabled:opacity-50"
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
          className="w-full text-center text-[11px] font-medium text-[#f59e0b] transition-all duration-200 hover:text-[#d97706]"
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
          <p className="text-sm text-[#5c6068]">Loading...</p>{' '}
        </div>
      }
    >
      {' '}
      <Verify2faForm />{' '}
    </Suspense>
  );
}
