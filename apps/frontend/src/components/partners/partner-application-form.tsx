'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

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
      toast({ type: 'err', title: t('submitFailed', { default: 'Submission failed' }), description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <h3 className="text-lg font-semibold">{t('successTitle', { default: 'Thank you' })}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('successBody', { default: 'We received your application.' })}</p>
        <p className="mt-2 font-mono text-xs">Ref: {reference}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <label className="block text-sm font-medium">Type
        <select className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>
          {TYPES.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Company
        <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" value={form.companyName} onChange={(e)=>setForm({...form,companyName:e.target.value})} />
      </label>
      <label className="block text-sm font-medium">Contact name
        <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" value={form.contactName} onChange={(e)=>setForm({...form,contactName:e.target.value})} />
      </label>
      <label className="block text-sm font-medium">Email
        <input type="email" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} />
      </label>
      <label className="block text-sm font-medium">Message
        <textarea required rows={5} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})} />
      </label>
      <button disabled={busy} type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}