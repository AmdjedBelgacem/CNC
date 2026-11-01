'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '@/stores/cart-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { useFxRates } from '@/hooks/use-fx-rates';
import { convertMinorUnits, formatMinorUnits } from '@/lib/money';
import { getImageSrc } from '@/lib/images';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { CheckoutStepper } from '@/components/store/checkout-stepper';
import { spring, transition } from '@/lib/motion';

export default function CartPage() {
  const t = useTranslations('pages.cart');
  const tp = useTranslations('products');
  const tc = useTranslations('checkout');
  // Shallow-compared: a whole-store read re-rendered the cart on every cart
  // write, including ones that only touched an unrelated field.
  const { items, removeItem, updateQuantity, itemCount } = useCartStore(
    useShallow((s) => ({
      items: s.items,
      removeItem: s.removeItem,
      updateQuantity: s.updateQuantity,
      itemCount: s.itemCount,
    })),
  );
  const locale = useLocale();
  const displayCurrency = useCurrencyStore((s) => s.code);
  const { rates } = useFxRates();

  // Line items keep their own currency; everything is shown in the chosen one.
  const lines = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        displayPrice: convertMinorUnits(item.price, item.currency, displayCurrency, rates),
      })),
    [items, displayCurrency, rates],
  );
  const total = lines.reduce((sum, line) => sum + line.displayPrice * line.quantity, 0);
  const money = (minor: number) => formatMinorUnits(minor, displayCurrency, locale);

  if (items.length === 0) {
    // `EmptyState` renders its title as a paragraph, so this branch had no heading at all —
    // an empty cart is a real page a visitor lands on and needs to be able to identify.
    return (
      <div className="container mx-auto px-4 py-24 md:py-32">
        <h1 className="sr-only">{t('title')}</h1>
        <EmptyState
          icon={ShoppingBag}
          title={tp('cartEmpty')}
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

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <CheckoutStepper
        steps={[tp('cart'), tc('paymentMethod'), tc('paidEyebrow')]}
        current={0}
        className="mb-10"
      />
      <Reveal as="header" className="mb-10">
        <p className="eyebrow">{tp('cart')}</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-[-0.022em] text-foreground md:text-[44px]">
          {t('title')}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground" aria-live="polite">
          {t('items', { count: itemCount() })}
        </p>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
        <ul className="space-y-3 lg:col-span-2">
          <AnimatePresence initial={false} mode="popLayout">
            {lines.map((item, i) => (
              <m.li
                key={item.productId}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { ...transition.enter, delay: Math.min(i * 0.04, 0.3) } }}
                exit={{ opacity: 0, x: -24, scale: 0.98, transition: transition.leave }}
                transition={spring.layout}
                className="rounded-2xl border border-border/70 bg-card shadow-xs"
              >
                <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:p-5">
                  <div className="relative flex aspect-square w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageSrc(item.thumbnailUrl, 'product')}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ShoppingBag className="size-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-medium tracking-[-0.012em] text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                      {money(item.displayPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/60 p-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="rounded-full"
                      aria-label={t('decreaseQuantity')}
                      onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    >
                      <Minus />
                    </Button>
                    <span className="relative w-8 overflow-hidden text-center text-sm font-medium tabular-nums text-foreground">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span
                          key={item.quantity}
                          className="inline-block"
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -10, opacity: 0 }}
                          transition={spring.snappy}
                        >
                          {item.quantity}
                        </m.span>
                      </AnimatePresence>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="rounded-full"
                      aria-label={t('increaseQuantity')}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <p className="w-28 text-end font-semibold tabular-nums text-foreground">
                    {money(item.displayPrice * item.quantity)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('removeItem', { title: item.title })}
                    onClick={() => {
                      removeItem(item.productId);
                      toast({ type: 'ok', title: t('removedToast', { title: item.title }) });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>

        <Reveal delay={0.08}>
          <Card className="rounded-2xl border-border/70 shadow-sm lg:sticky lg:top-24">
            <CardHeader>
              <p className="text-xs font-medium text-muted-foreground">{t('summary')}</p>
              <CardTitle className="font-display text-2xl font-medium tracking-[-0.018em]">
                {t('orderSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{tp('subtotal')}</span>
                <span className="tabular-nums text-foreground">{money(total)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{t('shipping')}</span>
                <span className="text-muted-foreground">{t('shippingHint')}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-4">
                <span className="text-sm font-medium text-foreground">{tp('total')}</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={total}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={spring.smooth}
                    className="font-display text-2xl font-medium tabular-nums tracking-[-0.015em] text-foreground"
                  >
                    {money(total)}
                  </m.span>
                </AnimatePresence>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" asChild>
                <Link href="/checkout">{t('proceedToCheckout')}</Link>
              </Button>
            </CardFooter>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
