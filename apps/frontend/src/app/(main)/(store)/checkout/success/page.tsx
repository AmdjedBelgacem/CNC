'use client';

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, Loader2, ShoppingBag, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { trackPurchase } from '@/lib/analytics';
import { useCartStore } from '@/stores/cart-store';
import { cn } from '@/lib/utils';

type DisplayStatus = 'verifying' | 'paid' | 'pending' | 'failed' | 'refunded' | 'canceled';

interface OrderLine {
  id: string;
  itemType: string;
  title: string;
  quantity: number;
  unitAmountCents: number;
  currency: string;
  fulfillmentState: string;
}

interface OrderView {
  id: string;
  status: string;
  total: number;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderLine[];
}

function Panel({
  tone,
  icon: Icon,
  spin,
  eyebrow,
  title,
  children,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'destructive';
  icon: ElementType;
  spin?: boolean;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-24">
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span
            className={cn(
              'flex size-16 items-center justify-center rounded-full',
              tone === 'success' && 'bg-success/10 text-success',
              tone === 'destructive' && 'bg-destructive/10 text-destructive',
              tone === 'warning' && 'bg-primary/10 text-primary',
              tone === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className={cn('size-8', spin && 'animate-spin')} />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const paymentId = searchParams.get('payment') ?? searchParams.get('id');

  const [status, setStatus] = useState<DisplayStatus>('verifying');
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseTracked = useRef(false);
  const clearCart = useCartStore((state) => state.clearCart);

  /**
   * Ask the backend to verify the payment with Moyasar and tell us what happened.
   * The browser's own view of success is never trusted — this call is what decides
   * whether the order is `paid`.
   */
  const verify = useCallback(async (): Promise<DisplayStatus | null> => {
    if (!orderId || !paymentId) {
      setError(t('missingReference'));
      setStatus('failed');
      return 'failed';
    }
    try {
      const response = await api.get<{
        status: string;
        fulfilled: boolean;
        reason: string | null;
        order: OrderView | null;
      }>(`/payments/moyasar/callback?order=${encodeURIComponent(orderId)}&payment=${encodeURIComponent(paymentId)}`);
      if (response.order) setOrder(response.order);
      const next = (response.status === 'paid'
        ? 'paid'
        : response.status === 'refunded'
          ? 'refunded'
          : response.status === 'canceled'
            ? 'canceled'
            : response.status === 'failed'
              ? 'failed'
              : 'pending') as DisplayStatus;
      setStatus(next);
      if (response.reason) setError(response.reason);
      return next;
    } catch (caught) {
      setError((caught as Error)?.message ?? t('verifyFailed'));
      setStatus('failed');
      return 'failed';
    }
  }, [orderId, paymentId, t]);

  // A webhook usually settles the order a moment before the payer lands back, but
  // polling covers the case where it has not arrived yet.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      const next = await verify();
      if (cancelled || next === 'paid' || next === 'failed' || next === 'refunded') return;
      attempts += 1;
      if (attempts < 8) setTimeout(poll, 2500);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [verify]);

  const cartCleared = useRef(false);
  useEffect(() => {
    if (status !== 'paid' || !order || purchaseTracked.current) return;
    purchaseTracked.current = true;
    trackPurchase({
      transactionId: order.id,
      totalCents: order.total,
      // The gateway's currency, not an assumed USD.
      currency: order.currency,
      items: order.items.map((line) => ({
        item_id: line.id,
        item_name: line.title,
        quantity: line.quantity,
        price: line.unitAmountCents / 100,
      })),
    });
    // The cart is emptied only now: a verified `paid` is the only state in which
    // the items are genuinely bought, so a failed or abandoned payment leaves the
    // cart intact to retry.
    if (cartCleared.current) return;
    cartCleared.current = true;
    clearCart();
  }, [status, order, clearCart]);

  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat('en-SA', { style: 'currency', currency }).format(minor / 100);

  if (status === 'verifying') {
    return (
      <Panel tone="neutral" icon={Loader2} spin eyebrow={t('verifyingEyebrow')} title={t('verifyingTitle')}>
        <p className="text-sm text-muted-foreground">{t('verifyingHint')}</p>
      </Panel>
    );
  }

  if (status === 'failed') {
    return (
      <Panel tone="destructive" icon={XCircle} eyebrow={t('failedEyebrow')} title={t('failedTitle')}>
        <p className="text-sm text-muted-foreground">
          {error ?? t('failedHint')}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button asChild>
            <Link href="/checkout">{t('tryAgain')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cart">{t('backToCart')}</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (status === 'pending') {
    return (
      <Panel tone="warning" icon={Clock} eyebrow={t('pendingEyebrow')} title={t('pendingTitle')}>
        <p className="text-sm text-muted-foreground">{t('pendingHint')}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button onClick={() => void verify()}>
            <Loader2 className="size-4" />
            {t('checkAgain')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/orders">{t('viewOrders')}</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (status === 'refunded' || status === 'canceled') {
    return (
      <Panel
        tone="warning"
        icon={Clock}
        eyebrow={t('refundedEyebrow')}
        title={status === 'refunded' ? t('refundedTitle') : t('canceledTitle')}
      >
        <p className="text-sm text-muted-foreground">{t('refundedHint')}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/account/orders">{t('viewOrders')}</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-2xl">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle className="size-8" />
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {t('paidEyebrow')}
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {t('paidTitle')}
            </h1>
            {order && (
              <p className="text-sm text-muted-foreground">
                {t('paidSubtitle')} <span className="font-medium text-foreground">{money(order.total, order.currency)}</span>
              </p>
            )}
          </div>

          {order && (
            <dl className="mt-6 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                  {t('orderRef')}
                </dt>
                <dd className="font-mono text-xs text-foreground">{order.id}</dd>
              </div>
              <div>
                <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                  {t('paymentRef')}
                </dt>
                <dd className="font-mono text-xs text-foreground">
                  {order.providerPaymentId ?? '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                  {t('itemsTitle')}
                </dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {order.items.map((line) => (
                      <li key={line.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-foreground">
                          {line.quantity} × {line.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {line.itemType}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/courses">
                <ShoppingBag className="size-4" />
                {t('keepShopping')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/orders">{t('viewOrders')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
