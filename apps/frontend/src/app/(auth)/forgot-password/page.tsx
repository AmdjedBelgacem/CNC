'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/components/ui/toast';
export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast({ type: 'ok', title: t('checkYourEmail') });
    } catch {
      setError(t('forgot.sendFailed'));
      toast({ type: 'err', title: t('forgot.sendFailed') });
    } finally {
      setLoading(false);
    }
  };
  if (sent) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        {' '}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          {' '}
          <svg
            className="h-7 w-7 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {' '}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />{' '}
          </svg>{' '}
        </div>{' '}
        <h1 className="font-display text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          {t('checkYourEmail')}{' '}
        </h1>{' '}
        <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
          {' '}
          {t('forgot.sentPrefix')} <strong className="text-foreground">{email}</strong>
          {t('forgot.sentSuffix')}{' '}
        </p>{' '}
        <div className="w-full rounded-xl border border-border bg-background/50 p-3.5 text-xs text-muted-foreground">
          {' '}
          {t('didntReceiveIt')}{' '}
          <button
            onClick={() => setSent(false)}
            className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
          >
            {t('tryAgain')}
          </button>{' '}
        </div>{' '}
        <p className="mt-6 text-sm text-muted-foreground">
          {' '}
          <Link
            href="/login"
            className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
          >
            {t('backToSignIn')}
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
          {t('forgot.eyebrow')}{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          {t('forgotPassword')}{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {' '}
          {t('forgot.hint')}{' '}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/30"
          />{' '}
        </div>{' '}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
        >
          {' '}
          {loading ? t('sending') : t('sendResetLink')}{' '}
        </button>{' '}
      </form>{' '}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {' '}
        {t('rememberPassword')}{' '}
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
