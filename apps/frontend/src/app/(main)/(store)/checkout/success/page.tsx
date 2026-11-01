'use client';

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, Loader2, ShoppingBag, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { trackPurchase } from '@/lib/analytics';
import { useCartStore } from '@/stores/cart-store';
import { cn } from '@/lib/utils';
import { m } from 'framer-motion';
import { Crossfade, Stagger, StaggerItem } from '@/components/ui/motion';
import { ease, transition } from '@/lib/motion';
import { CheckoutStepper } from '@/components/store/checkout-stepper';

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

type Tone = 'neutral' | 'success' | 'warning' | 'destructive';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success/10 text-success ring-success/20',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
  warning: 'bg-primary/10 text-primary ring-primary/20',
  neutral: 'bg-muted text-muted-foreground ring-border',
};

/** Springy status glyph. `celebrate` adds a one-shot ring + spark burst. */
function StatusGlyph({
  tone,
  icon: Icon,
  spin,
  celebrate,
}: {
  tone: Tone;
  icon: ElementType;
  spin?: boolean;
  celebrate?: boolean;
}) {
  return (
    <span className="relative flex size-20 items-center justify-center">
      {celebrate && (
        <>
          {[0, 1].map((ring) => (
            <m.span
              key={ring}
              aria-hidden
              className="absolute inset-0 rounded-full ring-1 ring-success/40"
              initial={{ scale: 0.8, opacity: 0.7 }}
              animate={{ scale: 2 + ring * 0.5, opacity: 0 }}
              transition={{ duration: 1.3, ease: ease.emerge, delay: 0.15 + ring * 0.18 }}
            />
          ))}
          {SPARKS.map((spark, i) => (
            <m.span
              key={i}
              aria-hidden
              className={cn('absolute size-1.5 rounded-full', spark.color)}
              initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
              animate={{
                x: Math.cos(spark.angle) * spark.distance,
                y: Math.sin(spark.angle) * spark.distance,
                scale: [0, 1, 0.6],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.1, ease: ease.emerge, delay: 0.22 + (i % 3) * 0.04 }}
            />
          ))}
        </>
      )}
      <m.span
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 17, mass: 0.9 }}
        className={cn('relative flex size-20 items-center justify-center rounded-full ring-1', TONE_CLASS[tone])}
      >
        <Icon className={cn('size-9', spin && 'animate-spin')} strokeWidth={1.75} />
      </m.span>
    </span>
  );
}

const SPARK_COLORS = ['bg-primary', 'bg-success', 'bg-accent'];
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2 + (i % 2 ? 0.12 : -0.08),
  distance: 58 + (i % 3) * 14,
  color: SPARK_COLORS[i % SPARK_COLORS.length],
}));

function Panel({
  tone,
  icon,
  spin,
  eyebrow,
  title,
  celebrate,
  wide,
  children,
}: {
  tone: Tone;
  icon: ElementType;
  spin?: boolean;
  eyebrow: string;
  title: string;
  celebrate?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto rounded-2xl border border-border/70 bg-card p-8 shadow-sm sm:p-10',
        wide ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <StatusGlyph tone={tone} icon={icon} spin={spin} celebrate={celebrate} />
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { ...transition.enter, delay: 0.12 } }}
          className="flex w-full flex-col items-center gap-4"
        >
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground">
              {title}
            </h1>
          </div>
          {children}
        </m.div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  const t = useTranslations('checkout');
  const tp = useTranslations('products');
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

  let body: ReactNode;
  if (status === 'verifying') {
    body = (
      <Panel tone="neutral" icon={Loader2} spin eyebrow={t('verifyingEyebrow')} title={t('verifyingTitle')}>
        <p className="text-[15px] text-muted-foreground">{t('verifyingHint')}</p>
      </Panel>
    );
  } else if (status === 'failed') {
    body = (
      <Panel tone="destructive" icon={XCircle} eyebrow={t('failedEyebrow')} title={t('failedTitle')}>
        <p className="text-[15px] text-muted-foreground">
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
  } else if (status === 'pending') {
    body = (
      <Panel tone="warning" icon={Clock} eyebrow={t('pendingEyebrow')} title={t('pendingTitle')}>
        <p className="text-[15px] text-muted-foreground">{t('pendingHint')}</p>
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
  } else if (status === 'refunded' || status === 'canceled') {
    body = (
      <Panel
        tone="warning"
        icon={Clock}
        eyebrow={t('refundedEyebrow')}
        title={status === 'refunded' ? t('refundedTitle') : t('canceledTitle')}
      >
        <p className="text-[15px] text-muted-foreground">{t('refundedHint')}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/account/orders">{t('viewOrders')}</Link>
        </Button>
      </Panel>
    );
  } else {
    body = (
      <Panel
        tone="success"
        icon={CheckCircle}
        celebrate
        wide
        eyebrow={t('paidEyebrow')}
        title={t('paidTitle')}
      >
        {order && (
          <p className="text-[15px] text-muted-foreground">
            {t('paidSubtitle')}{' '}
            <span className="font-display text-lg font-medium tabular-nums text-foreground">
              {money(order.total, order.currency)}
            </span>
          </p>
        )}

        {order && (
          <dl className="mt-2 grid w-full gap-4 rounded-xl border border-border/70 bg-muted/40 p-5 text-start text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t('orderRef')}</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-foreground">{order.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('paymentRef')}</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-foreground">
                {order.providerPaymentId ?? '—'}
              </dd>
            </div>
            <div className="border-t border-border/70 pt-4 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t('itemsTitle')}</dt>
              <dd>
                <Stagger as="ul" delay={0.35} className="mt-2 space-y-2">
                  {order.items.map((line, i) => (
                    <StaggerItem as="li" key={line.id} index={i} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-foreground">
                        <span className="tabular-nums text-muted-foreground">{line.quantity} ×</span> {line.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border/70">
                        {line.itemType}
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/courses">
              <ShoppingBag className="size-4" />
              {t('keepShopping')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/account/orders">{t('viewOrders')}</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <CheckoutStepper
        steps={[tp('cart'), t('paymentMethod'), t('paidEyebrow')]}
        current={status === 'paid' ? 3 : status === 'verifying' || status === 'pending' ? 2 : 1}
        className="mx-auto mb-12"
      />
      <Crossfade value={status === 'refunded' || status === 'canceled' ? 'closed' : status}>
        {body}
      </Crossfade>
    </div>
  );
}
