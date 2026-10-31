'use client';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Lock } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
interface ReauthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the password the user just proved, so callers don't re-prompt or send ''. */
  onVerified: (password: string) => void;
  title?: string;
  description?: string;
}
export function ReauthModal({
  open,
  onOpenChange,
  onVerified,
  title,
  description,
}: ReauthModalProps) {
  const t = useTranslations('ui.reauthModal');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setStatus('loading');
      try {
        // Through the shared client so the CSRF token is attached. As a raw `fetch` this
        // relied on the BFF minting a token server-side for it, which stops working the
        // moment that compatibility path is removed.
        // `api.post` resolves the parsed body and throws on a non-2xx, carrying `status`.
        await api.post('/auth/verify-password', { password });
        setStatus('success');
        toast({ type: 'ok', title: t('verified') });
        const verifiedPassword = password;
        setTimeout(() => {
          onOpenChange(false);
          onVerified(verifiedPassword);
        }, 800);
      } catch (err) {
        // 401/403 mean the password itself was wrong; anything else is transport or server.
        const status = (err as { status?: number })?.status;
        const body = (err as { body?: { message?: unknown } })?.body;
        const message =
          status === 401 || status === 403
            ? typeof body?.message === 'string'
              ? body.message
              : t('incorrectPassword')
            : t('genericError');
        setError(message);
        toast({ type: 'err', title: message });
        setStatus('idle');
      }
    },
    [password, onOpenChange, onVerified, t],
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setPassword('');
        setError(null);
        setStatus('idle');
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );
  const shownDescription = description ?? t('defaultDescription');
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center gap-2 px-4 pt-4 pe-4 text-center sm:px-6 sm:pe-6">
          <m.div
            className={cn(
              'mb-2 flex size-12 items-center justify-center rounded-full ring-1 transition-colors duration-300',
              status === 'success'
                ? 'bg-success/10 text-success ring-success/20'
                : 'bg-primary/10 text-primary ring-primary/15',
            )}
            animate={status === 'success' ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {status === 'success' ? (
                <m.span
                  key="ok"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={spring.snappy}
                >
                  <Check className="size-5" strokeWidth={2.5} />
                </m.span>
              ) : (
                <m.span
                  key="lock"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={spring.snappy}
                >
                  <Lock className="size-5" />
                </m.span>
              )}
            </AnimatePresence>
          </m.div>
          <DialogTitle className="text-center">{title ?? t('defaultTitle')}</DialogTitle>
          {shownDescription && (
            <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              {shownDescription}
            </p>
          )}
        </DialogHeader>
        <DialogBody className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reauth-password">{ta('password')}</Label>
              <Input
                id="reauth-password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status !== 'idle'}
                invalid={!!error}
                className="h-11"
                autoFocus
              />
            </div>
            <AnimatePresence initial={false}>
              {error && (
                <m.p
                  key="error"
                  role="alert"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: 'auto', y: 0, transition: transition.enter }}
                  exit={{ opacity: 0, height: 0, transition: transition.leave }}
                  className="overflow-hidden text-sm text-destructive"
                >
                  {error}
                </m.p>
              )}
            </AnimatePresence>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={status !== 'idle'}
              >
                {tc('cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!password || status !== 'idle'}
                loading={status === 'loading'}
              >
                {status === 'loading'
                  ? t('verifying')
                  : status === 'success'
                    ? t('verified')
                    : tc('continue')}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
