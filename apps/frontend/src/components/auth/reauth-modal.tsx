'use client';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';
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
        const verifiedPassword = password;
        setTimeout(() => {
          onOpenChange(false);
          onVerified(verifiedPassword);
        }, 800);
      } catch (err) {
        // 401/403 mean the password itself was wrong; anything else is transport or server.
        const status = (err as { status?: number })?.status;
        const body = (err as { body?: { message?: unknown } })?.body;
        setError(
          status === 401 || status === 403
            ? (typeof body?.message === 'string' ? body.message : t('incorrectPassword'))
            : t('genericError'),
        );
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
      {' '}
      <DialogContent className="sm:max-w-md">
        {' '}
        <DialogHeader className="flex flex-col items-center gap-2 pt-4">
          {' '}
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted">
            {' '}
            <Lock className="size-5 text-muted-foreground" />{' '}
          </div>{' '}
          <DialogTitle className="text-center">{title ?? t('defaultTitle')}</DialogTitle>{' '}
          {shownDescription && (
            <p className="text-center text-sm text-muted-foreground">
              {' '}
              {shownDescription}{' '}
            </p>
          )}{' '}
        </DialogHeader>{' '}
        <form onSubmit={handleSubmit} className="space-y-4">
          {' '}
          <div className="space-y-2">
            {' '}
            <Label htmlFor="reauth-password">{ta('password')}</Label>{' '}
            <Input
              id="reauth-password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status !== 'idle'}
              autoFocus
            />{' '}
          </div>{' '}
          {error && <p className="text-sm text-destructive">{error}</p>}{' '}
          <div className="flex gap-3 pt-2">
            {' '}
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={status !== 'idle'}
            >
              {' '}
              {tc('cancel')}
            </Button>{' '}
            <Button type="submit" className="flex-1" disabled={!password || status !== 'idle'}>
              {' '}
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  {' '}
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{' '}
                  {t('verifying')}{' '}
                </span>
              ) : status === 'success' ? (
                t('verified')
              ) : (
                tc('continue')
              )}{' '}
            </Button>{' '}
          </div>{' '}
        </form>{' '}
      </DialogContent>{' '}
    </Dialog>
  );
}
