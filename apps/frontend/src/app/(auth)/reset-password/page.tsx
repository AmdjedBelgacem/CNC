'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { m } from 'framer-motion';
import { toast } from '@/components/ui/toast';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  AuthAlert,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthStatus,
  AuthStatusIcon,
  AuthSteps,
  AuthSubmit,
  DrawnCheck,
} from '@/components/auth/auth-kit';
function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('reset.invalidLink'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      toast({ type: 'ok', title: t('reset.successTitle') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('reset.failed');
      setError(message);
      toast({ type: 'err', title: t('reset.failed'), description: message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthSteps step={success ? 'done' : 'form'}>
      {success ? (
        <AuthStatus
          icon={
            <AuthStatusIcon tone="success">
              <DrawnCheck />
            </AuthStatusIcon>
          }
          title={t('reset.successTitle')}
        >
          <p className="mb-7 mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {t('reset.successHint')}
          </p>
          <AuthSubmit type="button" onClick={() => router.push('/login')}>
            {t('reset.signInNewPassword')}
          </AuthSubmit>
        </AuthStatus>
      ) : (
        <div className="flex h-full flex-col justify-center">
          <AuthHeading eyebrow={t('reset.eyebrow')} title={t('reset.title')} subtitle={t('reset.hint')} />
          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthAlert show={!!error}>{error}</AuthAlert>
            <AuthAlert show={!token}>{t('reset.missingToken')}</AuthAlert>
            <AuthField id="password" label={t('newPasswordLabel')}>
              <AuthInput
                id="password"
                type="password"
                placeholder={t('newPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <PasswordMeter length={password.length} />
            </AuthField>
            <AuthField id="confirmPassword" label={t('confirmNewPasswordLabel')}>
              <AuthInput
                id="confirmPassword"
                type="password"
                placeholder={t('confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                invalid={!!error && password !== confirmPassword}
              />
            </AuthField>
            <AuthSubmit type="submit" disabled={loading || !token} loading={loading}>
              {loading ? t('reset.resetting') : t('reset.resetButton')}
            </AuthSubmit>
          </form>
        </div>
      )}
    </AuthSteps>
  );
}

/** Quiet 3-segment length meter (decorative; the real rule is enforced on submit). */
function PasswordMeter({ length }: { length: number }) {
  const filled = length === 0 ? 0 : length < 8 ? 1 : length < 12 ? 2 : 3;
  return (
    <div className="flex gap-1.5 pt-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <m.span
            className={cn(
              'block h-full origin-left rounded-full rtl:origin-right',
              filled === 1 ? 'bg-warning' : 'bg-success',
            )}
            initial={false}
            animate={{ scaleX: i < filled ? 1 : 0 }}
            transition={spring.smooth}
          />
        </span>
      ))}
    </div>
  );
}

export default function ResetPasswordPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">{tCommon('loading')}</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
