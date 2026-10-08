'use client';
import { useEffect, useMemo, useState } from 'react';
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
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { DEFAULT_CURRENCY, type InteractiveHotspot } from '@titan/shared';
import { useProduct, useRelatedProducts } from '@/hooks/use-products';
import { useFxRates } from '@/hooks/use-fx-rates';
import { useCartStore } from '@/stores/cart-store';
import { useCurrencyStore } from '@/stores/currency-store';
import { convertMinorUnits, formatMinorUnits, needsConversion } from '@/lib/money';
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
import type { Product, ProductVariant } from '@/lib/api/types';

interface ProductGalleryEntry {
  id: string;
  url: string;
  hotspots: InteractiveHotspot[];
}

export function ProductDetailClient({
  slug: slugProp,
  initialProduct,
}: {
  slug: string;
  initialProduct?: Product | null;
}) {
  // The server hands down the slug, but a client-side navigation to a different product
  // leaves the prop stale for a tick; `useParams` is the live value and wins.
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || slugProp;
  const t = useTranslations('products');
  const locale = useLocale();
  const router = useRouter();

  const { product, isLoading, isError, error, refetch } = useProduct(slug, initialProduct);
  const { products: related } = useRelatedProducts(product?.id ?? null);
  const addItem = useCartStore((s) => s.addItem);
  const displayCurrency = useCurrencyStore((s) => s.code);
  const { rates } = useFxRates();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-6 h-5 w-48 rounded-md" />
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3 rounded-lg" />
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

  const add = () => {
    if (displayPrice == null) return;
    addItem({
      productId: p.slug,
      title: p.title,
      price: displayPrice,
      currency,
      thumbnailUrl: p.thumbnailUrl ?? undefined,
    });
    toast({ type: 'ok', title: t('added') });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* -------------------------------------------------------- breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/products" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t('title')}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-foreground">{p.title}</span>
      </nav>

      {/* ------------------------------------------------------ hero / buy */}
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div
            id="product-image-panel"
            role="tabpanel"
            aria-labelledby={gallery.length > 1 ? `product-image-tab-${Math.min(imageIndex, gallery.length - 1)}` : undefined}
            className={cn(
              'relative overflow-hidden rounded-lg border border-border bg-muted',
              // An annotated product must not be cropped: the admin placed the
              // markers against the whole image, so a cover crop here would put
              // every marker on the wrong feature.
              hasPinpoints
                ? 'flex min-h-[22rem] items-center justify-center'
                : 'aspect-square',
            )}
          >
            <div className={cn('relative', hasPinpoints ? 'inline-block max-h-[34rem] max-w-full' : 'size-full')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageSrc(activeImage, 'product')}
                alt={p.title}
                className={hasPinpoints ? 'block max-h-[34rem] max-w-full object-contain' : 'size-full object-cover'}
                loading="eager"
              />

              {pinpointList.map((h, index) => {
                const isOpen = activeHotspotId === h.id;
                // The panel clips overflow, so the popup flips below the marker near the
                // top edge and shifts sideways near the left/right edges. It stays
                // attached to the marker in every case.
                const below = h.y < 28;
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
                        'relative flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-lg transition hover:scale-110',
                        isOpen
                          ? 'z-10 bg-primary text-primary-foreground ring-4 ring-primary/30'
                          : 'bg-primary/90 text-primary-foreground',
                      )}
                    >
                      {index + 1}
                    </button>

                    {isOpen && (
                      <span
                        role="dialog"
                        aria-label={h.label}
                        className={cn(
                          'absolute z-30 w-56 max-w-[min(16rem,72vw)] rounded-xl border border-primary/25 bg-card p-3 text-start shadow-2xl',
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
                            'absolute size-3 rotate-45 border-primary/25 bg-card',
                            below ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r',
                            shiftRight ? 'right-3' : shiftLeft ? 'left-3' : 'left-1/2 -translate-x-1/2',
                          )}
                        />
                        <span className="block text-2xs font-bold uppercase tracking-wider text-primary">
                          {index + 1}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-foreground">{h.label}</span>
                        {h.tooltip && (
                          <span className="mt-1 block text-xs text-muted-foreground">{h.tooltip}</span>
                        )}
                        {h.detail && (
                          <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{h.detail}</span>
                        )}
                      </span>
                    )}
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
                    setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)
                  }
                  className="absolute start-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-card/90 text-foreground shadow-xs transition hover:bg-muted"
                >
                  <ChevronLeft className="size-[18px] rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => setImageIndex((i) => (i + 1) % gallery.length)}
                  className="absolute end-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-card/90 text-foreground shadow-xs transition hover:bg-muted"
                >
                  <ChevronRight className="size-[18px] rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {gallery.length > 1 ? (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Product images"
              onKeyDown={(event) => {
                // Arrow keys move between thumbnails; without this the gallery is
                // mouse-only and unusable by keyboard.
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const delta = event.key === 'ArrowRight' ? 1 : -1;
                setImageIndex((i) => (i + delta + gallery.length) % gallery.length);
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
                  onClick={() => setImageIndex(i)}
                  aria-label={`Image ${i + 1} of ${gallery.length}`}
                  aria-current={i === imageIndex}
                  className={cn(
                    // `relative` is required: `next/image` with `fill` is absolutely
                    // positioned and resolves against the nearest positioned ancestor.
                    // Without it the tile escaped to the hero panel above and rendered
                    // that size — a full-bleed image over the product page.
                    'relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition',
                    i === imageIndex ? 'border-primary' : 'border-border hover:border-border-strong',
                  )}
                >
                  <Image src={getImageSrc(url, 'product')} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {p.category && (
                <Badge variant="soft" className="gap-1">
                  <Tag className="size-3.5" />
                  {p.category}
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

            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{p.title}</h1>
            {p.tagline && <p className="mt-1.5 text-lg text-muted-foreground">{p.tagline}</p>}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold tracking-tight text-foreground">
              {displayPrice == null ? t('priceOnRequest') : showPrice(displayPrice)}
            </span>
            {displayPrice != null && !!p.compareAtPrice && p.compareAtPrice > (p.price ?? 0) && (
              <span className="font-mono text-lg text-muted-foreground line-through">
                {showPrice(p.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'size-2 rounded-full',
                outOfStock ? 'bg-destructive' : backorder ? 'bg-warning' : 'bg-success',
              )}
            />
            <span className={outOfStock ? 'text-destructive' : 'text-muted-foreground'}>
              {outOfStock ? t('outOfStock') : backorder ? t('backorder') : t('inStock')}
            </span>
          </div>

          {!!p.variants?.length && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('details')}</h3>
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
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-border-strong',
                        soldOut && 'cursor-not-allowed opacity-50 line-through',
                      )}
                    >
                      {v.title}
                      {!!v.price && v.price !== p.price && (
                        <span className="ms-2 text-muted-foreground">
                          {showPrice(v.price)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="flex-1" disabled={outOfStock || displayPrice == null} onClick={add}>
              <ShoppingCart />
              {outOfStock ? t('outOfStock') : backorder ? t('buyNow') : t('addToCart')}
            </Button>
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
          </div>

          {backorder && (
            <p className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t('backorder')} — {(p as { backorderLeadDays?: number }).backorderLeadDays ?? 7}{' '}
              {t('inStock').toLowerCase()}
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- sections */}
      <div className="mt-14 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {p.description && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{t('description')}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            </section>
          )}

          {!!p.features?.length && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{t('includes')}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!!p.documents?.length && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{t('documents')}</h2>
              <ul className="space-y-2">
                {p.documents.map((doc, index) => (
                  <li key={`${doc.url}-${index}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs uppercase text-muted-foreground">PDF</span>
                      <span className="min-w-0 flex-1 truncate">{doc.title || doc.name || t('documents')}</span>
                      <Download className="size-4 shrink-0 text-primary" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t('specs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('category')}</dt>
                  <dd className="font-medium text-foreground">{p.category ?? '—'}</dd>
                </div>
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
      </div>

      {/* ------------------------------------------------------------ related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t('related')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.slice(0, 4).map((rp) => (
              <ProductCard
                key={rp.id}
                product={
                  {
                    ...rp,
                    price: rp.price ?? 0,
                    currency: rp.currency ?? 'USD',
                  } as Parameters<typeof ProductCard>[0]['product']
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
