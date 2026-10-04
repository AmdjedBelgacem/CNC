'use client';
import { CreditCard, Check, Zap, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function BillingPage() {
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <CreditCard className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Manage your subscription, invoices, and payment methods.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="bg-primary p-8 text-white">
          {' '}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
            {' '}
            <Crown className="size-5" />{' '}
          </div>{' '}
          <h2 className="mt-4 text-lg font-semibold">Upgrade to Pro</h2>{' '}
          <p className="mt-1 max-w-md text-sm leading-relaxed text-white/80">
            Unlock unlimited courses, certificates, and priority support. Cancel anytime.
          </p>{' '}
        </div>{' '}
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {' '}
          {[
            {
              name: 'Starter',
              price: 'Free',
              features: ['3 courses', 'Community access', 'Basic certificates'],
              cta: 'Current plan',
              active: true,
            },
            {
              name: 'Pro',
              price: '$29',
              suffix: '/mo',
              features: [
                'Unlimited courses',
                'Verified certificates',
                '1:1 mentorship',
                'Priority support',
              ],
              cta: 'Upgrade to Pro',
              highlight: true,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative overflow-hidden rounded-2xl border p-5 ${plan.highlight ? 'border-primary bg-primary/[0.03] shadow-md' : 'border-border bg-card'}`}
            >
              {' '}
              {plan.highlight && (
                <div className="absolute end-3 top-3 rounded-full bg-primary px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-primary-foreground">
                  Popular
                </div>
              )}{' '}
              <h3 className="text-sm font-semibold">{plan.name}</h3>{' '}
              <p className="mt-1">
                <span className="text-2xl font-bold">{plan.price}</span>
                {plan.suffix && (
                  <span className="text-sm text-muted-foreground">{plan.suffix}</span>
                )}
              </p>{' '}
              <ul className="mt-4 space-y-2">
                {' '}
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs">
                    <span className="flex size-4 items-center justify-center rounded-full bg-success/10 text-success">
                      <Check className="size-3.5" />
                    </span>{' '}
                    {f}
                  </li>
                ))}{' '}
              </ul>{' '}
              <Button
                className={`mt-5 w-full rounded-full ${plan.highlight ? '' : 'opacity-60'}`}
                variant={plan.highlight ? 'default' : 'outline'}
                disabled={plan.active}
              >
                {' '}
                {plan.cta} {plan.highlight && <ArrowRight className="flip-rtl ms-1 size-3.5" />}{' '}
              </Button>{' '}
            </div>
          ))}{' '}
        </div>{' '}
        <div className="border-t border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-primary" /> Billing is managed securely via Stripe.
            Invoices are emailed monthly.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <CreditCard className="size-3.5" />
            </span>{' '}
            Invoices
          </h2>{' '}
        </div>{' '}
        <div className="p-8 text-center">
          {' '}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <CreditCard className="size-6 text-muted-foreground" />
          </div>{' '}
          <p className="mt-3 text-sm font-medium">No invoices yet</p>{' '}
          <p className="text-xs text-muted-foreground">
            Your payment history will appear here.
          </p>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
