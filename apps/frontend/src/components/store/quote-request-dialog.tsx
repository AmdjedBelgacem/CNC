'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Quote request form.
 *
 * A modal rather than a separate page so the shopper keeps the product, its images and its
 * hotspot annotations in view — the whole reason they asked was this exact machine, and a
 * form on another route loses that. The product and variant travel with the submission so
 * the request cannot be attributed to the wrong thing.
 */
export function QuoteRequestDialog({
  open,
  onOpenChange,
  productId,
  productTitle,
  variantId,
  variantTitle,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  productId: string;
  productTitle: string;
  variantId?: string | null;
  variantTitle?: string | null;
}) {
  const t = useTranslations('products.quote');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (sending) return;
    setError('');
    onOpenChange(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError(t('nameRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t('emailInvalid'));
      return;
    }

    setSending(true);
    try {
      await api.post('/quotes', {
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        message: message.trim() || undefined,
        productId,
        variantId: variantId ?? undefined,
      });
      toast({ type: 'ok', title: t('sent'), description: t('sentHint') });
      // Clear only on success, so a failure leaves what the shopper typed intact.
      setName('');
      setEmail('');
      setCompany('');
      setMessage('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('subtitleFor', {
              product: productTitle,
              variant: variantTitle ? ` (${variantTitle})` : '',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-name">{t('name')}</Label>
                <Input
                  id="quote-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-email">{t('email')}</Label>
                <Input
                  id="quote-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quote-company">{t('company')}</Label>
              <Input
                id="quote-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quote-message">{t('message')}</Label>
              {/* No shared Textarea component exists; this matches the styling used by the
                other free-text fields in the app. */}
              <textarea
                id="quote-message"
                rows={4}
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                className="flex w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={sending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <Loader2 className={cn('size-4 animate-spin')} />
              ) : (
                <Send className={cn('size-4 rtl:-scale-x-100')} />
              )}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
