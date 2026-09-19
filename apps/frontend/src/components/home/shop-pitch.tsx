'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Wrench, CreditCard, HeadphonesIcon, TrendingUp, Loader2 } from 'lucide-react';
const features = [
  {
    icon: Wrench,
    title: 'Expert Guidance',
    description: 'Our team of experienced machinists helps you select the right equipment.',
  },
  {
    icon: CreditCard,
    title: 'Flexible Financing',
    description: 'Affordable payment plans and leasing options available.',
  },
  {
    icon: HeadphonesIcon,
    title: 'Service & Support',
    description: 'Dedicated support team for installation, training, and maintenance.',
  },
  {
    icon: TrendingUp,
    title: 'Industry Connections',
    description: 'Access to exclusive partnerships, discounts, and events.',
  },
];
export function ShopPitch() {
  const [showQuote, setShowQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    await fetch('/api/proxy/quotes', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        company: form.get('company'),
        message: form.get('message'),
      }),
    });
    setSubmitting(false);
    setDone(true);
  };
  return (
    <section className="py-24 relative overflow-hidden">
      {' '}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/30" />{' '}
      <div className="container mx-auto px-4 relative">
        {' '}
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {' '}
          <div>
            {' '}
            <h2 className="text-3xl font-bold mb-4">Equip Your Machine Shop</h2>{' '}
            <p className="text-muted-foreground mb-8">
              {' '}
              From single machines to full turnkey operations, our team helps you find the right
              equipment at the right price.{' '}
            </p>{' '}
            <div className="grid sm:grid-cols-2 gap-6">
              {' '}
              {features.map((f) => (
                <div key={f.title} className="flex gap-3">
                  {' '}
                  <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />{' '}
                  <div>
                    {' '}
                    <h3 className="font-semibold text-sm">{f.title}</h3>{' '}
                    <p className="text-xs text-muted-foreground">{f.description}</p>{' '}
                  </div>{' '}
                </div>
              ))}{' '}
            </div>{' '}
            <Button size="lg" className="mt-8" onClick={() => setShowQuote(true)}>
              {' '}
              Request a Quote{' '}
            </Button>{' '}
          </div>{' '}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-secondary/30 p-8 border">
            {' '}
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              {' '}
              <Wrench className="h-20 w-20 text-muted-foreground/30" />{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <Dialog open={showQuote} onOpenChange={setShowQuote}>
        {' '}
        <DialogContent>
          {' '}
          <DialogHeader>
            {' '}
            <DialogTitle>{done ? 'Quote Request Sent' : 'Request a Quote'}</DialogTitle>{' '}
          </DialogHeader>{' '}
          {done ? (
            <div className="text-center py-6">
              {' '}
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />{' '}
              <p className="text-muted-foreground">Our team will reach out within 24 hours.</p>{' '}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {' '}
              <input
                name="name"
                placeholder="Full name"
                required
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />{' '}
              <input
                name="email"
                type="email"
                placeholder="Email address"
                required
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />{' '}
              <input
                name="company"
                placeholder="Company name"
                required
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />{' '}
              <textarea
                name="message"
                placeholder="Tell us about your needs..."
                rows={4}
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary resize-none"
              />{' '}
              <Button className="w-full" disabled={submitting}>
                {' '}
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit
                Request{' '}
              </Button>{' '}
            </form>
          )}{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
    </section>
  );
}
