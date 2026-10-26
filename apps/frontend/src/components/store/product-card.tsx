'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_CURRENCY } from '@titan/shared';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, AlertTriangle, Mail } from 'lucide-react';
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
    <Card className="group flex h-full flex-col transition-colors hover:border-border-strong">
      <div className="p-3 pb-0">
        <Link
          href={href}
          className="relative block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
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
            className="object-cover"
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
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Badge variant="outline" className="bg-card px-3 py-1">
                {t('outOfStock')}
              </Badge>
            </div>
          )}
        </Link>
      </div>

      <CardHeader className="flex-1">
        <CardTitle className="font-display text-base leading-snug">
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

      <CardFooter className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4">
        {quoteOnly ? (
          /**
           * The cart is replaced, not disabled. A greyed-out "Add to cart" on a
           * machine that can only be quoted reads as a broken site; the request
           * form is the intended path and it notifies the tenant's admins.
           */
          <div className="flex w-full flex-col gap-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
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
                  'font-mono text-lg font-semibold tabular-nums',
                  pending ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {price}
              </span>
              {hasSale && product.compareAtPrice ? (
                <span className="ms-2 font-mono text-sm tabular-nums text-muted-foreground line-through">
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
                onClick={() =>
                  addItem({
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    price: product.variants?.[0]?.price ?? product.price ?? 0,
                    currency: sourceCurrency ?? DEFAULT_CURRENCY,
                    thumbnailUrl: product.thumbnailUrl ?? undefined,
                  })
                }
              >
                <ShoppingCart className="size-4" />
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
  );
}
