'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import {
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  DrawnCheck,
} from '@/components/auth/auth-kit';
function VerifyEmailContent() {
  const t = useTranslations('auth');
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
      setMessage(t('verifyEmail.invalidLink'));
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        toast({ type: 'ok', title: t('verifyEmail.successTitle') });
        setTimeout(() => router.push('/login'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        const message = err instanceof Error ? err.message : t('verifyEmail.failed');
        setMessage(message);
        toast({ type: 'err', title: t('verifyEmail.failed'), description: message });
      });
  }, [token, verifyEmail, router]);
  return (
    <AuthSteps step={status}>
      {status === 'verifying' && (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="primary">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </AuthStatusIcon>
          }
          title={t('verifyEmail.verifying')}
        >
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {t('verifyEmail.verifyingHint')}
          </p>
        </AuthStatus>
      )}
      {status === 'success' && (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="success">
              <DrawnCheck />
            </AuthStatusIcon>
          }
          title={t('verifyEmail.successTitle')}
        >
          <p className="mb-7 mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {t('verifyEmail.successHint')}
          </p>
          <AuthSubmit type="button" onClick={() => router.push('/login')}>
            {t('goToSignIn')}
          </AuthSubmit>
        </AuthStatus>
      )}
      {status === 'error' && (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="error">
              <X className="size-6" strokeWidth={2} aria-hidden />
            </AuthStatusIcon>
          }
          title={t('verifyEmail.failedTitle')}
        >
          <p className="mb-7 mt-3 text-[15px] leading-relaxed text-muted-foreground">{message}</p>
          <div className="w-full space-y-2.5">
            <AuthSubmit type="button" onClick={() => router.push('/login')}>
              {t('goToSignIn')}
            </AuthSubmit>
            <AuthSubmit
              type="button"
              variant="outline"
              onClick={() => router.push('/resend-verification')}
            >
              {t('verification.resend')}
            </AuthSubmit>
          </div>
        </AuthStatus>
      )}
    </AuthSteps>
  );
}
export default function VerifyEmailPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
