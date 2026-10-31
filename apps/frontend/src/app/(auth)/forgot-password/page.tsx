'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Mail } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import {
  AuthAlert,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthNote,
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  authLinkClass,
} from '@/components/auth/auth-kit';
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
  return (
    <AuthSteps step={sent ? 'sent' : 'form'}>
      {sent ? (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="primary">
              <Mail className="size-6" strokeWidth={1.75} aria-hidden />
            </AuthStatusIcon>
          }
          title={t('checkYourEmail')}
        >
          <p className="mb-7 mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {t('forgot.sentPrefix')} <strong className="font-medium text-foreground">{email}</strong>
            {t('forgot.sentSuffix')}
          </p>
          <AuthNote>
            {t('didntReceiveIt')}{' '}
            <button type="button" onClick={() => setSent(false)} className={authLinkClass}>
              {t('tryAgain')}
            </button>
          </AuthNote>
          <p className="mt-7 text-sm text-muted-foreground">
            <Link href="/login" className={authLinkClass}>
              {t('backToSignIn')}
            </Link>
          </p>
        </AuthStatus>
      ) : (
        <div className="flex h-full flex-col justify-center">
          <AuthHeading
            eyebrow={t('forgot.eyebrow')}
            title={t('forgotPassword')}
            subtitle={t('forgot.hint')}
          />
          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthAlert show={!!error}>{error}</AuthAlert>
            <AuthField id="email" label={t('email')}>
              <AuthInput
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                invalid={!!error}
              />
            </AuthField>
            <AuthSubmit type="submit" disabled={loading} loading={loading}>
              {loading ? t('sending') : t('sendResetLink')}
            </AuthSubmit>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">
            {t('rememberPassword')}{' '}
            <Link href="/login" className={authLinkClass}>
              {t('signIn')}
            </Link>
          </p>
        </div>
      )}
    </AuthSteps>
  );
}
