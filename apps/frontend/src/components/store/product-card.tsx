'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_CURRENCY } from '@titan/shared';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, AlertTriangle, Mail, Check } from 'lucide-react';
import { spring } from '@/lib/motion';
import { MotionCard } from '@/components/ui/motion';
import { useCartStore } from '@/stores/cart-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { useFxRates } from '@/hooks/use-fx-rates';
import { convertMinorUnits, formatMinorUnits, needsConversion } from '@/lib/money';
import { cardPrice, isQuoteOnly, pricingModeOf } from '@/lib/product-pricing';
import { QuoteRequestDialog } from '@/components/store/quote-request-dialog';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
/**
 * The card re-exports the API's own types rather than declaring its own.
 *
 * It used to keep parallel copies of `Product`/`ProductVariant`, and they drifted: the
 * local ones claimed `description?: string` where the API returns `null`, so nothing
 * server-fetched satisfied them and callers added casts to bridge the gap. One definition
 * removes the whole class of mismatch.
 */
import type { Product, ProductVariant } from '@/lib/api/types';

export type { Product, ProductVariant };

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const locale = useLocale();
  const t = useTranslations('products');
  const displayCurrency = useCurrencyStore((s) => s.code);
  const { rates } = useFxRates();
  const [quoteOpen, setQuoteOpen] = useState(false);
  // Purely visual acknowledgement after adding to cart: the icon flips to a check.
  const [justAdded, setJustAdded] = useState(false);
  useEffect(() => {
    if (!justAdded) return;
    const id = window.setTimeout(() => setJustAdded(false), 1400);
    return () => window.clearTimeout(id);
  }, [justAdded]);

  const pricingMode = pricingModeOf(product);
  const quoteOnly = isQuoteOnly(product);
  /**
   * A quote-only machine is not stock-constrained in the cart sense: there is no
   * add-to-cart control to disable and a made-to-order unit can legitimately have
   * zero on hand. Treating it as out of stock would cover the photo and hide the
   * only useful action on the card.
   */
  const outOfStock = !quoteOnly && (product.inventory ?? 0) <= 0 && !product.allowBackorder;
  const backorder = !quoteOnly && (product.inventory ?? 0) <= 0 && product.allowBackorder;
  const sourceCurrency = product.currency || DEFAULT_CURRENCY;
  // Until live rates land we cannot state a converted price without lying.
  const pending = needsConversion(sourceCurrency, displayCurrency, rates);
  const convert = (minor?: number | null) =>
    pending ? null : convertMinorUnits(minor, sourceCurrency, displayCurrency, rates);
  const format = (minor?: number | null) =>
    pending ? t('pricePending') : formatMinorUnits(convert(minor), displayCurrency, locale);
  const unitMinor = cardPrice(product);
  const unitDisplay = convert(unitMinor) ?? 0;
  const price = quoteOnly
    ? t('priceOnRequest')
    : unitMinor == null
      ? pricingMode === 'from'
        ? t('priceOnRequest')
        : t('priceNotSet')
      : pricingMode === 'from'
        ? t('priceFrom', { price: format(unitMinor) })
        : format(unitMinor);
  // Compare-at is a fixed-price discount signal. Showing it beside "from" or a
  // quote prompt would leak a figure the mode exists to withhold.
  const compareAtDisplay =
    pricingMode === 'fixed' && product.compareAtPrice ? convert(product.compareAtPrice) : null;
  const hasSale = Boolean(compareAtDisplay !== null && compareAtDisplay > unitDisplay);
  const href = `/products/${product.slug}`;

  return (
    <MotionCard lift={5} className="h-full">
    <Card className="card-hover group flex h-full flex-col rounded-2xl border-border/70 shadow-xs">
      <div className="p-2.5 pb-0">
        <Link
          href={href}
          className="relative block aspect-square overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/*
           * Optimized rather than a raw <img>: a card is displayed around 200-400 px, but
           * the original is a multi-megabyte photo. `sizes` tells the optimizer what width
           * to produce, and it re-encodes to AVIF/WebP for the request.
           */}
          <Image
            src={getImageSrc(product.thumbnailUrl, 'product')}
            alt={product.title}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
            {product.featured && <Badge>{t('featured')}</Badge>}
            {product.isDigital && <Badge variant="secondary">{t('digital')}</Badge>}
            {backorder && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="size-3.5" />
                {t('backorder')}
              </Badge>
            )}
            {hasSale && <Badge variant="destructive">{t('sale')}</Badge>}
          </div>
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <Badge variant="outline" className="bg-card px-3 py-1 shadow-xs">
                {t('outOfStock')}
              </Badge>
            </div>
          )}
        </Link>
      </div>

      <CardHeader className="flex-1 gap-1.5 px-4 pb-4 pt-4">
        {(product.category || product.productType) && (
          <p className="text-xs text-muted-foreground">
            {[product.category, product.productType].filter(Boolean).join(' · ')}
          </p>
        )}
        <CardTitle className="text-pretty font-display text-[17px] font-medium leading-snug tracking-[-0.012em]">
          <Link href={href} className="transition-colors hover:text-primary">
            {product.title}
          </Link>
        </CardTitle>
        {product.tagline && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {product.tagline}
          </p>
        )}
      </CardHeader>

      <CardFooter className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 px-4 pb-4 pt-3.5">
        {quoteOnly ? (
          /**
           * The cart is replaced, not disabled. A greyed-out "Add to cart" on a
           * machine that can only be quoted reads as a broken site; the request
           * form is the intended path and it notifies the tenant's admins.
           */
          <div className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t('priceOnRequest')}
            </span>
            <Button
              size="sm"
              className="w-full"
              aria-label={`${t('requestQuote')}: ${product.title}`}
              onClick={() => setQuoteOpen(true)}
            >
              <Mail className="size-4" />
              {t('requestQuote')}
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <span
                className={cn(
                  'text-lg font-semibold tabular-nums tracking-[-0.01em]',
                  pending ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {price}
              </span>
              {hasSale && product.compareAtPrice ? (
                <span className="ms-2 text-sm tabular-nums text-muted-foreground line-through">
                  {format(product.compareAtPrice)}
                </span>
              ) : null}
            </div>
            {!outOfStock && (
              <Button
                size="sm"
                variant={backorder ? 'outline' : 'default'}
                aria-label={`${backorder ? t('backorder') : t('addToCart')}: ${product.title}`}
                disabled={unitMinor == null}
                title={unitMinor == null ? t('priceNotSet') : undefined}
                onClick={() => {
                  addItem({
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    price: product.variants?.[0]?.price ?? product.price ?? 0,
                    currency: sourceCurrency ?? DEFAULT_CURRENCY,
                    thumbnailUrl: product.thumbnailUrl ?? undefined,
                  });
                  setJustAdded(true);
                }}
              >
                <span className="relative inline-flex size-4 items-center justify-center" aria-hidden>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={justAdded ? 'added' : 'cart'}
                      className="absolute inset-0 inline-flex items-center justify-center"
                      initial={{ scale: 0.4, opacity: 0, rotate: justAdded ? -30 : 0 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={spring.snappy}
                    >
                      {justAdded ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                    </m.span>
                  </AnimatePresence>
                </span>
                {/* Below `lg` the card is narrow (or beside the filter rail), so the
                    label is dropped and the button stays icon-only on one line. */}
                <span className="hidden lg:inline">
                  {backorder ? t('backorder') : t('addToCart')}
                </span>
              </Button>
            )}
          </>
        )}
      </CardFooter>
      {quoteOnly ? (
        <QuoteRequestDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          productId={product.id}
          productTitle={product.title}
        />
      ) : null}
    </Card>
    </MotionCard>
  );
}
