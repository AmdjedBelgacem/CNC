'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { MailCheck } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import {
  AuthField,
  AuthHeading,
  AuthInput,
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  authLinkClass,
} from '@/components/auth/auth-kit';
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
    <AuthSteps step={sent ? 'sent' : 'form'}>
      {sent ? (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="primary">
              <MailCheck className="size-6" strokeWidth={1.75} aria-hidden />
            </AuthStatusIcon>
          }
          title={t('verification.resend')}
        >
          <p className="mb-7 mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {t('resend.sent')}
          </p>
          <AuthSubmit type="button" onClick={() => (window.location.href = '/login')}>
            {t('backToSignIn')}
          </AuthSubmit>
        </AuthStatus>
      ) : (
        <div className="flex h-full flex-col justify-center">
          <AuthHeading
            eyebrow={t('resend.eyebrow')}
            title={t('verification.resend')}
            subtitle={t('resend.hint')}
          />
          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthField id="email" label={t('email')}>
              <AuthInput
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </AuthField>
            <AuthSubmit type="submit" disabled={loading} loading={loading}>
              {loading ? t('sending') : t('resend.sendLink')}
            </AuthSubmit>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">
            <Link href="/login" className={authLinkClass}>
              {t('backToSignIn')}
            </Link>
          </p>
        </div>
      )}
    </AuthSteps>
  );
}
