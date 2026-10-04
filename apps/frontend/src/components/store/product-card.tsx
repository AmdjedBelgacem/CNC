'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_CURRENCY } from '@titan/shared';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { useFxRates } from '@/hooks/use-fx-rates';
import { convertMinorUnits, formatMinorUnits, needsConversion } from '@/lib/money';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
export interface Product {
  id: string;
  title: string;
  slug: string;
  tagline?: string;
  description?: string;
  features?: string[];
  thumbnailUrl?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  inventory?: number;
  allowBackorder?: boolean;
  backorderLeadDays?: number;
  isDigital?: boolean;
  isPublished?: boolean;
  category?: string;
  tags?: string[];
  featured?: boolean;
  sortOrder?: number;
  academyId?: string;
  courseId?: string;
  createdAt?: string;
  updatedAt?: string;
  variants?: ProductVariant[];
}
export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price?: number;
  inventory?: number;
  allowBackorder?: boolean;
  options?: Record<string, string>;
}
export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const locale = useLocale();
  const t = useTranslations('products');
  const displayCurrency = useCurrencyStore((s) => s.code);
  const { rates } = useFxRates();
  const outOfStock = (product.inventory ?? 0) <= 0 && !product.allowBackorder;
  const backorder = (product.inventory ?? 0) <= 0 && product.allowBackorder;
  const sourceCurrency = product.currency || DEFAULT_CURRENCY;
  // Until live rates land we cannot state a converted price without lying.
  const pending = needsConversion(sourceCurrency, displayCurrency, rates);
  const convert = (minor?: number | null) =>
    pending ? null : convertMinorUnits(minor, sourceCurrency, displayCurrency, rates);
  const format = (minor?: number | null) =>
    pending ? t('pricePending') : formatMinorUnits(convert(minor), displayCurrency, locale);
  const unitMinor = product.variants?.[0]?.price ?? product.price;
  const unitDisplay = convert(unitMinor) ?? 0;
  const price = format(unitMinor);
  const compareAtDisplay = product.compareAtPrice ? convert(product.compareAtPrice) : null;
  const hasSale = Boolean(compareAtDisplay !== null && compareAtDisplay > unitDisplay);
  const href = `/products/${product.slug}`;

  return (
    <Card className="group flex h-full flex-col transition-colors hover:border-border-strong">
      <div className="p-3 pb-0">
        <Link
          href={href}
          className="relative block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageSrc(product.thumbnailUrl, 'product')}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover"
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
            onClick={() =>
              addItem({
                productId: product.slug,
                title: product.title,
                price: product.variants?.[0]?.price ?? product.price,
                currency: sourceCurrency,
                thumbnailUrl: product.thumbnailUrl,
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
      </CardFooter>
    </Card>
  );
}
