'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { ShieldCheck } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Crossfade } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import {
  AuthAlert,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthStatusIcon,
  AuthSubmit,
  authLinkClass,
} from '@/components/auth/auth-kit';
function Verify2faForm() {
  const t = useTranslations('auth');
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
      toast({ type: 'ok', title: t('twoFactor.verified') });
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('twoFactor.invalidCode');
      setError(message);
      toast({ type: 'err', title: t('twoFactor.invalidCode'), description: message });
    } finally {
      setLoading(false);
    }
  };
  const mode = useRecovery ? 'recovery' : 'code';
  return (
    <div className="flex h-full flex-col justify-center">
      <AuthHeading
        align="center"
        icon={
          <AuthStatusIcon tone="primary">
            <ShieldCheck className="size-6" strokeWidth={1.6} aria-hidden />
          </AuthStatusIcon>
        }
        title={t('twoFactor.eyebrow')}
        subtitle={
          <Crossfade value={mode} axis="none">
            <p>{useRecovery ? t('twoFactor.recoveryHint') : t('twoFactor.codeHint')}</p>
          </Crossfade>
        }
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthAlert show={!!error}>{error}</AuthAlert>
        <Crossfade value={mode} axis="x" distance={12}>
          <AuthField
            id="token"
            label={useRecovery ? t('twoFactor.recoveryLabel') : t('twoFactor.codeLabel')}
            labelClassName="block w-full text-center text-muted-foreground"
          >
            <AuthInput
              id="token"
              type="text"
              inputMode={useRecovery ? 'text' : 'numeric'}
              placeholder={useRecovery ? 'XXXX-XXXXXX' : '000000'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoFocus
              autoComplete="one-time-code"
              maxLength={useRecovery ? 10 : 6}
              invalid={!!error}
              className="h-14 rounded-xl bg-background/60 text-center font-mono text-2xl tracking-[0.4em] placeholder:text-muted-foreground/50 sm:text-2xl"
            />
          </AuthField>
        </Crossfade>
        <AuthSubmit type="submit" disabled={loading} loading={loading}>
          {loading ? t('twoFactor.verifying') : t('twoFactor.verify')}
        </AuthSubmit>
        <button
          type="button"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setToken('');
            setError('');
          }}
          className={cn('mx-auto block text-sm', authLinkClass)}
        >
          {useRecovery ? t('twoFactor.useAuthenticator') : t('twoFactor.useRecovery')}
        </button>
      </form>
    </div>
  );
}
export default function Verify2faPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
        </div>
      }
    >
      <Verify2faForm />
    </Suspense>
  );
}
