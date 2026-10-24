'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/components/ui/toast';
export default function ResendVerificationPage() {
  const t = useTranslations('auth');
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
      toast({ type: 'ok', title: t('verification.sent') });
    } catch (err) {
      toast({
        type: 'err',
        title: t('verification.sendFailed'),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex h-full flex-col justify-center">
      {' '}
      <div className="mb-6">
        {' '}
        <p className="mb-1.5 text-2xs font-bold uppercase tracking-[0.15em] text-primary">
          {' '}
          {t('resend.eyebrow')}{' '}
        </p>{' '}
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {' '}
          {t('verification.resend')}{' '}
        </h1>{' '}
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {' '}
          {sent ? t('resend.sent') : t('resend.hint')}{' '}
        </p>{' '}
      </div>{' '}
      {!sent && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {' '}
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
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50"
          >
            {' '}
            {loading ? t('sending') : t('resend.sendLink')}{' '}
          </button>{' '}
        </form>
      )}{' '}
      {sent && (
        <button
          onClick={() => (window.location.href = '/login')}
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          {' '}
          {t('backToSignIn')}{' '}
        </button>
      )}{' '}
      {!sent && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {' '}
          <Link
            href="/login"
            className="font-bold text-primary transition-all duration-200 hover:text-primary/80"
          >
            {t('backToSignIn')}
          </Link>{' '}
        </p>
      )}{' '}
    </div>
  );
}
