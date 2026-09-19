'use client';
import { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
interface ReauthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}
export function ReauthModal({
  open,
  onOpenChange,
  onVerified,
  title = 'Confirm your password',
  description = 'For security, please enter your password to continue.',
}: ReauthModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setStatus('loading');
      try {
        const res = await fetch('/api/proxy/auth/verify-password', { credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          setError(
            res.status === 401 || res.status === 403
              ? 'Incorrect password'
              : 'Something went wrong. Please try again.',
          );
          setStatus('idle');
          return;
        }
        setStatus('success');
        setTimeout(() => {
          onOpenChange(false);
          onVerified();
        }, 800);
      } catch {
        setError('Something went wrong. Please try again.');
        setStatus('idle');
      }
    },
    [password, onOpenChange, onVerified],
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
          <DialogTitle className="text-center">{title}</DialogTitle>{' '}
          {description && (
            <p className="text-center text-sm text-muted-foreground"> {description} </p>
          )}{' '}
        </DialogHeader>{' '}
        <form onSubmit={handleSubmit} className="space-y-4">
          {' '}
          <div className="space-y-2">
            {' '}
            <Label htmlFor="reauth-password">Password</Label>{' '}
            <Input
              id="reauth-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status !== 'idle'}
              autoFocus
            />{' '}
          </div>{' '}
          {error && <p className="text-sm text-red-400">{error}</p>}{' '}
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
              Cancel{' '}
            </Button>{' '}
            <Button type="submit" className="flex-1" disabled={!password || status !== 'idle'}>
              {' '}
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  {' '}
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{' '}
                  Verifying...{' '}
                </span>
              ) : status === 'success' ? (
                'Verified'
              ) : (
                'Continue'
              )}{' '}
            </Button>{' '}
          </div>{' '}
        </form>{' '}
      </DialogContent>{' '}
    </Dialog>
  );
}
