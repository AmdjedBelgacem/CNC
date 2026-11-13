'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Mail,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { DEFAULT_CURRENCY, type InteractiveHotspot } from '@titan/shared';
import { useProduct, useRelatedProducts } from '@/hooks/use-products';
import { useFxRates } from '@/hooks/use-fx-rates';
import { useCartStore } from '@/stores/cart-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { convertMinorUnits, formatMinorUnits, needsConversion } from '@/lib/money';
import {
  isQuoteOnly as isQuoteOnlyProduct,
  lowestPositivePrice,
  pricingModeOf,
} from '@/lib/product-pricing';
import { ProductCard } from '@/components/store/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';
import { QuoteRequestDialog } from '@/components/store/quote-request-dialog';
import type { Product, ProductVariant } from '@/lib/api/types';
import { Reveal } from '@/components/ui/motion';
import { ease, spring, transition } from '@/lib/motion';

interface ProductGalleryEntry {
  id: string;
  url: string;
  hotspots: InteractiveHotspot[];
}

export function ProductDetailClient({
  slug: slugProp,
  initialProduct,
  initialRelated,
}: {
  slug: string;
  initialProduct?: Product | null;
  initialRelated?: { productId: string; products: Product[] } | null;
}) {
  // The server hands down the slug, but a client-side navigation to a different product
  // leaves the prop stale for a tick; `useParams` is the live value and wins.
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || slugProp;
  const t = useTranslations('products');
  const locale = useLocale();
  const router = useRouter();

  const { product, isLoading, isError, error, refetch } = useProduct(slug, initialProduct);
  const { products: related } = useRelatedProducts(product?.id ?? null, undefined, initialRelated);
  const addItem = useCartStore((s) => s.addItem);
  const displayCurrency = useCurrencyStore((s) => s.code);
  const { rates } = useFxRates();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  // The first image renders without an entrance (it is the LCP); only images the
  // shopper navigates to crossfade in. `galleryDir` picks which side they arrive from.
  const [galleryMoved, setGalleryMoved] = useState(false);
  const [galleryDir, setGalleryDir] = useState<1 | -1>(1);
  // Declared before the early returns below: a hook after a conditional return
  // changes the hook count between the loading and loaded renders.
  const [quoteOpen, setQuoteOpen] = useState(false);
  const selectImage = (next: number | ((i: number) => number), dir?: 1 | -1) => {
    const value = typeof next === 'function' ? next(imageIndex) : next;
    setGalleryMoved(true);
    setGalleryDir(dir ?? (value >= imageIndex ? 1 : -1));
    setImageIndex(value);
  };

  // Reset selections when navigating between products.
  useEffect(() => {
    setSelectedVariant(null);
    setImageIndex(0);
  }, [slug]);

  /**
   * Gallery comes from the ordered `images[]` the API now returns, primary first.
   *
   * Before the gallery table it was `[thumbnailUrl, ...mediaUrls]`, which silently
   * dropped any image the admin had reordered or promoted, and `mediaUrls` is legacy
   * data that is no longer written. `mediaUrls` is kept only as a fallback for a
   * product whose gallery has not been seeded yet.
   */
  const gallery = useMemo(() => {
    if (!product) return [] as ProductGalleryEntry[];
    const source = product as unknown as {
      images?: Array<{ id?: string; url?: string; hotspots?: InteractiveHotspot[] | null }> | null;
      mediaUrls?: string[] | null;
    };
    const fromImages = (source.images ?? [])
      .map((image) => ({
        id: image?.id ?? image?.url ?? '',
        url: typeof image?.url === 'string' ? image.url.trim() : '',
        hotspots: Array.isArray(image?.hotspots) ? image.hotspots : [],
      }))
      .filter((image) => image.url.length > 0)
      // De-duplicate by URL, keeping the first (sorted) row's hotspots.
      .filter((image, index, all) => all.findIndex((o) => o.url === image.url) === index);
    if (fromImages.length > 0) return fromImages;
    const legacy = [product.thumbnailUrl, ...(source.mediaUrls ?? [])].filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    return Array.from(new Set(legacy)).map((url) => ({ id: url, url, hotspots: [] }));
  }, [product]);

  const galleryUrls = useMemo(() => gallery.map((image) => image.url), [gallery]);

  /**
   * Hotspots of the image currently on screen.
   *
   * They are read per image rather than from the product, because a marker at 40%/30%
   * points at a different part of the part on every picture. `product.pinpoints` is only
   * consulted as a fallback for a product with a single image, which is the one case
   * where a product-level list is unambiguous.
   */
  const pinpointList = useMemo(() => {
    const active = gallery[Math.min(imageIndex, Math.max(0, gallery.length - 1))];
    const own = (active?.hotspots ?? []).filter(
      (h) => typeof h?.x === 'number' && typeof h?.y === 'number' && Boolean(h.id),
    );
    if (own.length > 0 || gallery.length > 1) return own;
    return ((product as unknown as { pinpoints?: InteractiveHotspot[] | null })?.pinpoints ?? []).filter(
      (h) => typeof h?.x === 'number' && typeof h?.y === 'number' && Boolean(h.id),
    );
  }, [gallery, imageIndex, product]);
  const hasPinpoints = pinpointList.length > 0;

  // A popup belongs to the marker that opened it, so switching image or product closes it.
  useEffect(() => {
    setActiveHotspotId(null);
  }, [imageIndex, slug]);

  // Click anywhere outside the marker/popover closes it. `pointerdown` rather than
  // `click` so the popup is already gone before the underlying element reacts.
  useEffect(() => {
    if (!activeHotspotId) return;
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('[data-hotspot-root]')) setActiveHotspotId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveHotspotId(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeHotspotId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 h-5 w-48 rounded-full" />
        <div className="grid gap-12 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3 rounded-lg" />
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          title={t('loadFailed')}
          description={(error as Error)?.message}
          onRetry={() => void refetch()}
        />
        <div className="mt-6 text-center">
          <Button variant="outline" asChild>
            <Link href="/products">{t('title')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const p = product as Product & { pinpoints?: InteractiveHotspot[] | null; documents?: { title?: string; url: string; name?: string; size?: number }[] | null };
  const displayPrice = selectedVariant?.price ?? p.price ?? null;
  const stock = selectedVariant?.inventory ?? p.inventory ?? 0;
  const allowBackorder = selectedVariant?.allowBackorder ?? p.allowBackorder ?? false;
  const outOfStock = stock <= 0 && !allowBackorder;
  const backorder = stock <= 0 && allowBackorder;
  const currency = p.currency ?? DEFAULT_CURRENCY;
  // The page states prices in the shopper's chosen currency, converted live.
  const pricePending = needsConversion(currency, displayCurrency, rates);
  const inDisplay = (minor: number | null | undefined) =>
    pricePending ? null : convertMinorUnits(minor, currency, displayCurrency, rates);
  const showPrice = (minor: number | null | undefined) =>
    pricePending ? t('pricePending') : formatMinorUnits(inDisplay(minor), displayCurrency, locale);
  const activeEntry = gallery[Math.min(imageIndex, Math.max(0, gallery.length - 1))];
  const activeImage = activeEntry?.url ?? '';

  /**
   * How this product is priced.
   *
   * `from` takes the lowest figure a buyer could actually pay — the product price and
   * every variant price — rather than a separate "from" field an admin could set to
   * something the options do not support. Computed here because the variants are already
   * in the payload.
   */
  const pricingMode = pricingModeOf(p);
  const fromPrice = lowestPositivePrice(p);
  const isQuoteOnly = isQuoteOnlyProduct(p);
  /**
   * In `request` mode no figure is shown at all — not the stored price, not a
   * "from". A price left on the row is kept for reference but publishing it would
   * defeat the mode: the whole point is that the figure depends on the configuration.
   *
   * 'fixed' keeps the exact figure, including a legitimately zero-priced digital good,
   * which must not be mistaken for "no price".
   */
  const headlinePrice = isQuoteOnly ? null : pricingMode === 'from' ? fromPrice : displayPrice;

  const add = () => {
    if (displayPrice == null) return;
    addItem({
      // The checkout API looks the line up by primary key, so this must be the id.
      productId: p.id,
      slug: p.slug,
      title: p.title,
      price: displayPrice,
      currency,
      thumbnailUrl: p.thumbnailUrl ?? undefined,
    });
    toast({ type: 'ok', title: t('added') });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      {/* -------------------------------------------------------- breadcrumb */}
      <nav className="mb-8 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/products"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 -ms-2 transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          {t('title')}
        </Link>
        <span aria-hidden className="text-border-strong">/</span>
        <span className="truncate text-foreground">{p.title}</span>
      </nav>

      {/* ------------------------------------------------------ hero / buy */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div
            id="product-image-panel"
            role="tabpanel"
            aria-labelledby={gallery.length > 1 ? `product-image-tab-${Math.min(imageIndex, gallery.length - 1)}` : undefined}
            className={cn(
              'group/gallery relative rounded-2xl border border-border/70 bg-muted shadow-xs',
              // An annotated product must not be cropped: the admin placed the
              // markers against the whole image, so a cover crop here would put
              // every marker on the wrong feature. Annotated panels also must not
              // clip: hotspot popups open outside the image and were being cut at
              // the panel edge. Plain products keep the crop for the slide
              // transition, and round the image through overflow-hidden instead.
              hasPinpoints
                ? 'flex min-h-[22rem] items-center justify-center'
                : 'aspect-square overflow-hidden',
            )}
          >
            <div className={cn('relative', hasPinpoints ? 'inline-block max-h-[34rem] max-w-full' : 'size-full')}>
              {/* Keyed on the image so each newly selected picture eases in from the side
                  the shopper moved toward. `initial={false}` on first paint keeps the LCP
                  image visible without waiting for JS. */}
              <m.img
                key={activeImage}
                src={getImageSrc(activeImage, 'product')}
                alt={p.title}
                className={hasPinpoints ? 'block max-h-[34rem] max-w-full rounded-2xl object-contain' : 'size-full object-cover'}
                loading="eager"
                initial={galleryMoved ? { opacity: 0, x: galleryDir * 18, scale: 1.015 } : false}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.42, ease: ease.emerge }}
              />

              {pinpointList.map((h, index) => {
                const isOpen = activeHotspotId === h.id;
                // A marker in the upper part of the image flips its popup below, so
                // the panel opens over the picture instead of drifting into the
                // header; near the left/right edges it shifts sideways. It stays
                // attached to the marker in every case.
                const below = h.y < 42;
                const shiftRight = h.x < 30;
                const shiftLeft = h.x > 70;
                return (
                  <span
                    key={h.id}
                    data-hotspot-root
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  >
                    <button
                      type="button"
                      aria-label={h.label}
                      aria-expanded={isOpen}
                      onClick={() => setActiveHotspotId(isOpen ? null : h.id)}
                      className={cn(
                        'relative flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card text-xs font-semibold shadow-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
                        isOpen
                          ? 'z-10 bg-primary text-primary-foreground ring-4 ring-primary/30'
                          : 'bg-primary/90 text-primary-foreground',
                      )}
                    >
                      {index + 1}
                    </button>

                    <AnimatePresence>
                    {isOpen && (
                      <m.span
                        initial={{ opacity: 0, y: below ? -6 : 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97, transition: transition.leave }}
                        transition={spring.smooth}
                        style={{ transformOrigin: below ? 'top center' : 'bottom center' }}
                        role="dialog"
                        aria-label={h.label}
                        className={cn(
                          'absolute z-30 w-56 max-w-[min(16rem,72vw)] rounded-xl border border-border/80 bg-card p-3.5 text-start shadow-xl',
                          below
                            ? 'top-[calc(100%+0.85rem)]'
                            : 'bottom-[calc(100%+0.85rem)]',
                          shiftRight ? 'translate-x-4' : shiftLeft ? '-translate-x-[6.5rem]' : '-translate-x-1/2',
                        )}
                      >
                        {/* Notch pointing back at the marker the popup belongs to. */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute size-3 rotate-45 border-border/80 bg-card',
                            below ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r',
                            shiftRight ? 'right-3' : shiftLeft ? 'left-3' : 'left-1/2 -translate-x-1/2',
                          )}
                        />
                        <span className="block font-mono text-2xs font-medium text-primary">
                          {index + 1}
                        </span>
                        <span className="mt-0.5 block font-display text-[15px] font-medium text-foreground">{h.label}</span>
                        {h.tooltip && (
                          <span className="mt-1 block text-xs text-muted-foreground">{h.tooltip}</span>
                        )}
                        {h.detail && (
                          <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{h.detail}</span>
                        )}
                      </m.span>
                    )}
                    </AnimatePresence>
                  </span>
                );
              })}
            </div>

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() =>
                    selectImage((i) => (i - 1 + gallery.length) % gallery.length, -1)
                  }
                  className="absolute start-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-card active:scale-95 md:opacity-0 md:group-hover/gallery:opacity-100 md:focus-visible:opacity-100"
                >
                  <ChevronLeft className="size-[18px] rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => selectImage((i) => (i + 1) % gallery.length, 1)}
                  className="absolute end-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-card active:scale-95 md:opacity-0 md:group-hover/gallery:opacity-100 md:focus-visible:opacity-100"
                >
                  <ChevronRight className="size-[18px] rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {gallery.length > 1 ? (
            <div
              className="flex gap-2.5 overflow-x-auto p-1"
              role="tablist"
              aria-label="Product images"
              onKeyDown={(event) => {
                // Arrow keys move between thumbnails; without this the gallery is
                // mouse-only and unusable by keyboard.
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const delta = event.key === 'ArrowRight' ? 1 : -1;
                selectImage((i) => (i + delta + gallery.length) % gallery.length, delta as 1 | -1);
              }}
            >
              {galleryUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  role="tab"
                  id={`product-image-tab-${i}`}
                  aria-selected={i === imageIndex}
                  aria-controls="product-image-panel"
                  tabIndex={i === imageIndex ? 0 : -1}
                  onClick={() => selectImage(i)}
                  aria-label={`Image ${i + 1} of ${gallery.length}`}
                  aria-current={i === imageIndex}
                  className={cn(
                    // `relative` is required: `next/image` with `fill` is absolutely
                    // positioned and resolves against the nearest positioned ancestor.
                    // Without it the tile escaped to the hero panel above and rendered
                    // that size — a full-bleed image over the product page.
                    'relative size-16 shrink-0 rounded-xl bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    i === imageIndex ? 'opacity-100' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  <span className="absolute inset-0 overflow-hidden rounded-xl border border-border/70">
                    <Image src={getImageSrc(url, 'product')} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  {i === imageIndex && (
                    <m.span
                      layoutId={`product-thumb-ring-${p.id}`}
                      aria-hidden
                      className="pointer-events-none absolute -inset-[3px] rounded-[14px] ring-2 ring-primary"
                      transition={spring.smooth}
                    />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-7">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {p.category && (
                <Badge variant="soft" className="gap-1">
                  <Tag className="size-3.5" />
                  {p.category}
                </Badge>
              )}
              {p.productType && (
                <Badge variant="soft-muted" className="gap-1">
                  <Layers className="size-3.5" />
                  {p.productType}
                </Badge>
              )}
              {p.isDigital && (
                <Badge variant="soft-muted" className="gap-1">
                  <Download className="size-3.5" />
                  {t('instant')}
                </Badge>
              )}
              {backorder && (
                <Badge variant="warning" className="gap-1">
                  <AlertTriangle className="size-3.5" />
                  {t('backorder')}
                </Badge>
              )}
            </div>

            <h1 className="text-balance font-display text-[34px] font-medium leading-[1.08] tracking-[-0.022em] text-foreground md:text-[42px]">
              {p.title}
            </h1>
            {p.tagline && (
              <p className="mt-3 max-w-prose text-pretty text-lg leading-relaxed text-muted-foreground">
                {p.tagline}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-3 border-y border-border/60 py-5">
            {pricingMode === 'from' && headlinePrice != null ? (
              <span className="font-display text-3xl font-medium tabular-nums tracking-[-0.02em] text-foreground">
                {t('priceFrom', { price: showPrice(headlinePrice) })}
              </span>
            ) : (
              <span className="font-display text-3xl font-medium tabular-nums tracking-[-0.02em] text-foreground">
                {headlinePrice == null ? t('priceOnRequest') : showPrice(headlinePrice)}
              </span>
            )}
            {/* Only meaningful in `fixed`: a struck-through figure beside "from X" or a
                quote prompt would leak the very price the mode exists to withhold. */}
            {pricingMode === 'fixed' && displayPrice != null && !!p.compareAtPrice && p.compareAtPrice > (p.price ?? 0) && (
              <span className="text-lg tabular-nums text-muted-foreground line-through">
                {showPrice(p.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex size-2">
              {!outOfStock && !backorder && (
                <span className="absolute inset-0 animate-ping rounded-full bg-success/50 [animation-duration:2.4s]" />
              )}
              <span
                className={cn(
                  'relative size-2 rounded-full',
                  outOfStock ? 'bg-destructive' : backorder ? 'bg-warning' : 'bg-success',
                )}
              />
            </span>
            <span className={outOfStock ? 'text-destructive' : 'text-muted-foreground'}>
              {outOfStock ? t('outOfStock') : backorder ? t('backorder') : t('inStock')}
            </span>
          </div>

          {!!p.variants?.length && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">{t('details')}</h3>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => {
                  const active = selectedVariant?.id === v.id;
                  const soldOut = (v.inventory ?? 0) <= 0 && !v.allowBackorder;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setSelectedVariant(v)}
                      aria-pressed={active}
                      className={cn(
                        'relative rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary/60 text-primary'
                          : 'border-border bg-card hover:border-border-strong',
                        soldOut && 'cursor-not-allowed opacity-50 line-through',
                      )}
                    >
                      {active && (
                        <m.span
                          layoutId={`variant-pill-${p.id}`}
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-primary/10"
                          transition={spring.smooth}
                        />
                      )}
                      <span className="relative">
                        {v.title}
                        {!!v.price && v.price !== p.price && (
                          <span className="ms-2 tabular-nums text-muted-foreground">
                            {showPrice(v.price)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/*
            A quote-only product has no price to commit to, so the cart is replaced rather
            than disabled. A greyed-out "Add to cart" reads as a broken site; a clear
            "Request a quote" reads as the intended path.
          */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {isQuoteOnly ? (
              <Button size="lg" className="flex-1" onClick={() => setQuoteOpen(true)}>
                <Mail />
                {t('requestQuote', { default: 'Request a quote' })}
              </Button>
            ) : (
              <Button size="lg" className="flex-1" disabled={outOfStock || displayPrice == null} onClick={add}>
                <ShoppingCart />
                {outOfStock ? t('outOfStock') : backorder ? t('buyNow') : t('addToCart')}
              </Button>
            )}
            {!isQuoteOnly ? (
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                disabled={outOfStock || displayPrice == null}
                onClick={() => {
                  add();
                  router.push('/checkout');
                }}
              >
                {t('buyNow')}
              </Button>
            ) : null}
          </div>

          {backorder && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t('backorder')} — {(p as { backorderLeadDays?: number }).backorderLeadDays ?? 7}{' '}
              {t('inStock').toLowerCase()}
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- sections */}
      <div className="mt-20 grid gap-10 border-t border-border/70 pt-14 lg:grid-cols-3 lg:gap-14">
        <div className="space-y-12 lg:col-span-2">
          {p.description && (
            <Reveal as="section">
              <h2 className="mb-4 font-display text-2xl font-medium tracking-[-0.018em] text-foreground">{t('description')}</h2>
              <p className="max-w-prose whitespace-pre-line text-[15px] leading-[1.75] text-muted-foreground">
                {p.description}
              </p>
            </Reveal>
          )}

          {!!p.features?.length && (
            <Reveal as="section">
              <h2 className="mb-4 font-display text-2xl font-medium tracking-[-0.018em] text-foreground">{t('includes')}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {!!p.documents?.length && (
            <Reveal as="section">
              <h2 className="mb-4 font-display text-2xl font-medium tracking-[-0.018em] text-foreground">{t('documents')}</h2>
              <ul className="space-y-2">
                {p.documents.map((doc, index) => (
                  <li key={`${doc.url}-${index}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="card-hover group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm font-medium text-foreground shadow-xs"
                    >
                      <span className="rounded-lg bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">PDF</span>
                      <span className="min-w-0 flex-1 truncate">{doc.title || doc.name || t('documents')}</span>
                      <Download className="size-4 shrink-0 text-primary transition-transform group-hover:translate-y-0.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>

        <Reveal as="div" delay={0.05}>
        <aside>
          <Card className="rounded-2xl border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
                {t('specs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('category')}</dt>
                  <dd className="font-medium text-foreground">{p.category ?? '—'}</dd>
                </div>
                {p.productType && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{t('productType')}</dt>
                      <dd className="text-end font-medium text-foreground">{p.productType}</dd>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('format')}</dt>
                  <dd className="font-medium text-foreground">
                    {p.isDigital ? t('instant') : t('physical')}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('inventory')}</dt>
                  <dd className="font-medium text-foreground">
                    {outOfStock ? t('outOfStock') : t('inStock')}
                  </dd>
                </div>
                {!!p.tags?.length && (
                  <>
                    <Separator />
                    <div>
                      <dt className="mb-2 text-muted-foreground">{t('details')}</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {p.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-2xs">
                            {tag}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
        </Reveal>
      </div>

      {/* ------------------------------------------------------------ related */}
      {related.length > 0 && (
        <section className="mt-20 border-t border-border/70 pt-14">
          <Reveal>
            <h2 className="mb-8 font-display text-3xl font-medium tracking-[-0.02em] text-foreground">{t('related')}</h2>
          </Reveal>
          <Reveal delay={0.06} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.slice(0, 4).map((rp) => (
              // Pass the API row through unchanged. Forcing a null price to `0`
              // made every quote-only related machine look free; the card now
              // branches on `pricingMode` and ignores the stored reference price.
              <ProductCard key={rp.id} product={rp} />
            ))}
          </Reveal>
        </section>
      )}

      <QuoteRequestDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        productId={p.id}
        productTitle={p.title}
        variantId={selectedVariant?.id ?? null}
        variantTitle={selectedVariant?.title ?? null}
      />
    </div>
  );
}