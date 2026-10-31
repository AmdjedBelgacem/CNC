'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import { m } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Crossfade } from '@/components/ui/motion';
import { spring } from '@/lib/motion';

const TYPES = ['sponsor', 'distributor', 'training_center', 'affiliate', 'other'];

export default function PartnerApplicationForm() {
  const t = useTranslations('partners');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    type: 'sponsor',
    companyName: '',
    contactName: '',
    email: '',
    website: '',
    phone: '',
    country: '',
    city: '',
    message: '',
    audienceSize: '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res: any = await api.post('/partners/apply', form);
      setReference(res?.id ?? 'submitted');
      toast({ type: 'ok', title: t('submitted', { default: 'Application submitted' }) });
    } catch (err: any) {
      toast({
        type: 'err',
        title: t('submitFailed', { default: 'Submission failed' }),
        description: err?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1.5 font-normal';
  return (
    <Crossfade value={reference ? 'done' : 'form'}>
      {reference ? (
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
          <m.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { ...spring.snappy, delay: 0.08 } }}
            className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/20"
          >
            <Check className="size-6" />
          </m.span>
          <h3 className="font-display text-2xl font-medium tracking-[-0.018em]">
            {t('successTitle', { default: 'Thank you' })}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('successBody', { default: 'We received your application.' })}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Ref: <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">{reference}</span>
          </p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8"
        >
          <label className="block text-sm font-medium">
            Type
            <select
              className={`${field} flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15`}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Company
              <Input
                required
                className={field}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Contact name
              <Input
                required
                className={field}
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Email
            <Input
              type="email"
              required
              className={field}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Message
            <Textarea
              required
              rows={5}
              className={field}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button disabled={busy} type="submit">
              {busy && (
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              )}
              {busy ? 'Submitting…' : 'Submit application'}
            </Button>
          </div>
        </form>
      )}
    </Crossfade>
  );
}
