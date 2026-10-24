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

export default function CartPage() {
  const t = useTranslations('pages.cart');
  const tp = useTranslations('products');
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
      <div className="container mx-auto px-4 py-24">
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
    <div className="container mx-auto px-4 py-12">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {tp('cart')}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('items', { count: itemCount() })}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {lines.map((item) => (
            <Card key={item.productId}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                  <ShoppingBag className="size-8 text-muted-foreground/50" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="font-mono text-sm tabular-nums text-muted-foreground">
                    {money(item.displayPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label={t('decreaseQuantity')}
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm font-medium text-foreground">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label={t('increaseQuantity')}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <p className="w-28 text-right font-mono font-semibold tabular-nums text-foreground">
                  {money(item.displayPrice * item.quantity)}
                </p>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t('removeItem', { title: item.title })}
                  onClick={() => {
                    removeItem(item.productId);
                    toast({ type: 'ok', title: t('removedToast', { title: item.title }) });
                  }}
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Card>
            <CardHeader>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {t('summary')}
              </p>
              <CardTitle className="font-display">{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {tp('subtotal')}
                </span>
                <span className="font-mono tabular-nums text-foreground">{money(total)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {t('shipping')}
                </span>
                <span className="text-muted-foreground">{t('shippingHint')}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {tp('total')}
                </span>
                <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  {money(total)}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" asChild>
                <Link href="/checkout">{t('proceedToCheckout')}</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
