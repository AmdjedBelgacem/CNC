'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, GraduationCap, Loader2, Lock, ShoppingBag, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { trackBeginCheckout } from '@/lib/analytics';
import { api } from '@/lib/api-client';
import type { OrderView } from '@/hooks/use-payments';

/** Loads Moyasar's hosted form. PCI scope stays with the gateway. */
const MOYASAR_SCRIPT = 'https://cdn.moyasar.com/sdk/v1/moyasar.js';

let moyasarScriptPromise: Promise<void> | null = null;

function loadMoyasar(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as { Moyasar?: unknown }).Moyasar) return Promise.resolve();
  if (moyasarScriptPromise) return moyasarScriptPromise;
  moyasarScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MOYASAR_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment form'));
    document.head.appendChild(script);
  });
  return moyasarScriptPromise;
}

interface CreatedOrder {
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  publishableKey: string | null;
  /**
   * Signed pointer for the gateway metadata. It lets a `payment_paid` webhook
   * find this order even if it arrives before the browser comes back.
   */
  orderRef?: { orderId: string; sig: string } | null;
}

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const locale = useLocale();
  const items = useCartStore((state) => state.items);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state.hydrated);

  // A direct buy (course, event ticket) arrives as /checkout?order=<id>: the
  // order already exists, so this page must load it rather than build a new one
  // from the cart — otherwise the payer sees an empty cart and, worse, a second
  // order is created for a purchase they did not intend.
  const searchParams = useSearchParams();
  const requestedOrderId = searchParams.get('order');
  const [directOrder, setDirectOrder] = useState<OrderView | null>(null);
  const [loadingDirect, setLoadingDirect] = useState(Boolean(requestedOrderId));
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState<string | null>(null);
  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : `k-${Date.now()}`),
    [],
  );

  const createOrder = useCallback(async () => {
    setCreating(true);
    setError('');
    try {
      const result = await api.post<CreatedOrder>('/payments/moyasar/create-order', {
        lines: items.map((item) => ({
          itemType: 'product',
          refId: item.productId,
          quantity: item.quantity,
        })),
        // A retry of the same cart must not create a second order.
        idempotencyKey,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/cart`,
      });
      setOrder(result);
      trackBeginCheckout(
        items.map((i) => ({ item_id: i.productId, item_name: i.title, quantity: i.quantity, price: i.price / 100 })),
        result.amount,
        // The order's own currency, so the funnel is consistent end to end.
        result.currency,
      );
      return result;
    } catch (caught) {
      const message = (caught as Error)?.message ?? 'Could not start checkout';
      // Fail closed: no order, no form, and the cart is untouched.
      if (/not configured|disabled|missing/i.test(message)) setBlocked(message);
      else setError(message);
      return null;
    } finally {
      setCreating(false);
    }
  }, [idempotencyKey, items]);

  // Direct-buy path: fetch the pending order and render the server's own view of
  // it. Amount, currency and line titles all come from the server, because the
  // form is about to charge that exact number.
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !requestedOrderId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await api.get<{ data: OrderView }>(
          `/payments/orders/${encodeURIComponent(requestedOrderId)}`,
        );
        if (cancelled) return;
        const found = response.data;
        if (found.status !== 'pending') {
          setError(
            found.status === 'paid'
              ? t('alreadyPaid')
              : t('orderNotPayable'),
          );
          return;
        }
        // The publishable key comes from the tenant's config, never from the URL.
        const config = await api.get<{
          data: { publishableKey: string | null; status: string; currency: string };
        }>('/payments/moyasar/config');
        if (cancelled) return;
        if (config.data.status !== 'ready') {
          setBlocked(config.data.status === 'not_configured' ? t('unavailableGeneric') : config.data.status);
          return;
        }
        setPublishableKey(config.data.publishableKey);
        setDirectOrder(found);
      } catch {
        // 404 here means it is not this buyer's order, which is also the answer
        // for an expired or canceled one.
        if (!cancelled) setError(t('orderNotFound'));
      } finally {
        if (!cancelled) setLoadingDirect(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, requestedOrderId, t]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      const back = requestedOrderId ? `/checkout?order=${requestedOrderId}` : '/checkout';
      router.replace(`/login?returnUrl=${encodeURIComponent(back)}`);
      return;
    }
    // With a direct buy there is nothing to build from the cart.
    if (requestedOrderId) return;
    if (items.length > 0 && !order) void createOrder();
  }, [hydrated, isAuthenticated, items.length, order, createOrder, router, requestedOrderId]);

  /**
   * The order actually being paid, whichever way the payer arrived.
   *
   * Both paths must produce the same shape because the form charges
   * `amount`/`currency` from here, and those numbers have to be the server's.
   */
  const effective = directOrder
    ? {
        orderId: directOrder.id,
        amount: directOrder.total,
        currency: directOrder.currency,
        publishableKey,
        // A reloaded direct buy has no signature in hand, so the reference is
        // omitted rather than faked: the callback still resolves the order, and a
        // webhook arriving before it is handled by the retry below.
        orderRef: null,
        lines: directOrder.items.map((line) => ({
          key: line.id,
          title: line.title,
          quantity: line.quantity,
          itemType: line.itemType,
        })),
      }
    : order
      ? {
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          publishableKey: order.publishableKey,
          orderRef: order.orderRef ?? null,
          lines: items.map((item) => ({
            key: item.productId,
            title: item.title,
            quantity: item.quantity,
            itemType: 'product',
          })),
        }
      : null;

  // Mount the form only after the order exists and the script is ready.
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!effective?.publishableKey || !formRef.current) return;
    let cancelled = false;
    void loadMoyasar().then(() => {
      if (cancelled || !formRef.current) return;
      const Moyasar = (window as unknown as {
        Moyasar?: {
          createPaymentForm: (config: Record<string, unknown>) => { mount: (el: HTMLElement) => void };
        };
      }).Moyasar;
      if (!Moyasar) {
        setError('The payment form could not be initialised');
        return;
      }
      const form = Moyasar.createPaymentForm({
        publishableKey: effective.publishableKey,
        amount: effective.amount,
        currency: effective.currency,
        description: `TITANS order ${effective.orderId.slice(0, 8)}`,
        // The callback carries our order id, so verification knows what to check.
        callback_url: `${window.location.origin}/checkout/success?order=${effective.orderId}`,
        methods: ['creditcard', 'mada', 'applepay', 'stcpay'],
        // The signed reference is what lets an early webhook find this order.
        metadata: effective.orderRef
          ? { order_ref: `${effective.orderRef.orderId}.${effective.orderRef.sig}` }
          : { order_id: effective.orderId },
      });
      form.mount(formRef.current);
    }).catch(() => setError('Could not load the payment form'));
    return () => {
      cancelled = true;
    };
  }, [effective]);

  if (!requestedOrderId && items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24">
        <EmptyState
          icon={ShoppingBag}
          title={t('emptyTitle')}
          description={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/products">{t('browseStore')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency,
    }).format(minor / 100);

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {t('eyebrow')}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {blocked ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">{t('unavailableTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{blocked}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t('unavailableHint')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {t('orderItems')}
            </h2>
            {effective?.lines.map((line) => (
              <Card key={line.key}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex aspect-square w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    {line.itemType === 'course' ? (
                      <GraduationCap className="size-6 text-muted-foreground/50" />
                    ) : line.itemType === 'event_ticket' ? (
                      <Ticket className="size-6 text-muted-foreground/50" />
                    ) : (
                      <ShoppingBag className="size-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display font-medium text-foreground">{line.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('quantity')}: {line.quantity}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="pt-2">
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {t('paymentMethod')}
              </h2>
              {creating || loadingDirect || (!effective && !error) ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('preparing')}
                </div>
              ) : (
                <div ref={formRef} className="rounded-lg border border-border p-4" />
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {effective ? money(effective.amount, effective.currency) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-base">
                  <span className="font-semibold text-foreground">{t('total')}</span>
                  <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                    {effective ? money(effective.amount, effective.currency) : '—'}
                  </span>
                </div>
                {effective && (
                  <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                    {t('orderRef')} {effective.orderId.slice(0, 8)}
                  </p>
                )}
                <p className="flex items-start gap-1.5 pt-1 text-2xs text-muted-foreground">
                  <Lock className="mt-px size-3 shrink-0" />
                  {t('pciNote')}
                </p>
                {/* The cart is emptied by the success page once the payment is
                    verified, so there is deliberately no "clear" button here. */}
              </CardContent>
            </Card>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">{error}</span>
                {!requestedOrderId && (
                  <Button size="sm" variant="ghost" onClick={() => void createOrder()}>
                    {t('retry')}
                  </Button>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
