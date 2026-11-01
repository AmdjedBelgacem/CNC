'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';
import { XCircle, Loader2 } from 'lucide-react';
import {
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  DrawnCheck,
} from '@/components/auth/auth-kit';
function VerifyEmailChangeInner() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('emailChange.missingToken'));
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
          const message = data.message || t('emailChange.success');
          setMessage(message);
          toast({ type: 'ok', title: t('emailChange.success') });
        } else {
          setStatus('error');
          const message = data.message || t('emailChange.failed');
          setMessage(message);
          toast({ type: 'err', title: t('emailChange.failed'), description: message });
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('emailChange.networkError'));
        toast({ type: 'err', title: t('emailChange.failed'), description: t('emailChange.networkError') });
      });
  }, [token]);
  return (
    <AuthSteps step={status}>
      <AuthStatus
        icon={
          status === 'loading' ? (
            <AuthStatusIcon tone="primary">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </AuthStatusIcon>
          ) : status === 'success' ? (
            <AuthStatusIcon tone="success">
              <DrawnCheck />
            </AuthStatusIcon>
          ) : (
            <AuthStatusIcon tone="error">
              <XCircle className="size-6" strokeWidth={1.75} aria-hidden />
            </AuthStatusIcon>
          )
        }
        title={t('emailChange.title')}
      >
        <p className="mt-2 text-sm text-muted-foreground">{t('emailChange.description')}</p>
        <p className="mb-7 mt-5 text-[15px] leading-relaxed text-foreground/80">
          {status === 'loading' ? t('emailChange.verifying') : message}
        </p>
        {status === 'success' && (
          <AuthSubmit asChild>
            <Link href="/login">{t('signIn')}</Link>
          </AuthSubmit>
        )}
        {status === 'error' && (
          <AuthSubmit asChild variant="outline">
            <Link href="/settings/account/security">{t('emailChange.backToSecurity')}</Link>
          </AuthSubmit>
        )}
      </AuthStatus>
    </AuthSteps>
  );
}
export default function VerifyEmailChangePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-1 items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailChangeInner />
    </Suspense>
  );
}
