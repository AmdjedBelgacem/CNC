'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Globe, GlobeLock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { ContentLocale, ProductContentTranslation } from '@titan/shared';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/api/normalize';
import { AdminCommandBar, AdminPageHeader, BarButton } from '@/components/admin/admin-chrome';
import { FormSkeleton } from '@/components/admin/admin-form';
import { FormLayout, SaveDock, SectionNav, StatusChip } from '@/components/admin/form-page';
import { ErrorBanner } from '@/components/admin/admin-ui';
import {
  ProductFormSections,
  PublishReadiness,
  productFormPayload,
  productReadinessChecks,
  productSectionItems,
  useProductForm,
  type ProductFormValue,
} from '../../product-form';
import type { InteractiveHotspot } from '@titan/shared';
import { ProductGalleryManager } from '../../product-gallery';

export interface ProductImage {
  id: string;
  productId?: string;
  url: string;
  alt: string | null;
  /** Hotspots belong to this single image, not to the product as a whole. */
  hotspots?: InteractiveHotspot[] | null;
  sortOrder: number;
  isPrimary: boolean;
}

interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  features: string[] | null;
  thumbnailUrl: string | null;
  mediaUrls: string[] | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  pricingMode?: 'fixed' | 'from' | 'request' | null;
  inventory: number | null;
  trackInventory: boolean;
  allowBackorder: boolean;
  backorderLeadDays: number | null;
  isDigital: boolean;
  isPublished: boolean;
  isArchived: boolean;
  featured: boolean;
  category: string | null;
  productType: string | null;
  tags: string[] | null;
  sortOrder: number | null;
  academyId: string | null;
  courseId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  images?: ProductImage[] | null;
  pinpoints?: any[] | null;
  documents?: any[] | null;
  academy?: { id: string; title: string; slug: string } | null;
  course?: { id: string; title: string; slug: string } | null;
  variants?: unknown[];
  // The shared type, so product translations cannot drift from the schema the API stores.
  translations?: Partial<Record<ContentLocale, ProductContentTranslation>> | null;
}

/** The form value that a saved product corresponds to, used for dirty tracking. */
function baselineOf(p: ProductDetail): ProductFormValue {
  const allImageHotspots: InteractiveHotspot[] = [];
  if (Array.isArray(p.images)) {
    for (const img of p.images) {
      if (Array.isArray(img.hotspots)) {
        for (const h of img.hotspots) {
          if (!allImageHotspots.some((existing) => existing.id === h.id)) {
            allImageHotspots.push(h);
          }
        }
      }
    }
  }
  const rawPins = Array.isArray((p as any).pinpoints) ? (p as any).pinpoints : [];
  const mergedPins = [...rawPins];
  for (const h of allImageHotspots) {
    if (!mergedPins.some((existing: any) => existing.id === h.id)) {
      mergedPins.push(h);
    }
  }

  return {
    title: p.title ?? '',
    slug: p.slug ?? '',
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    productType: p.productType ?? '',
    priceCents: p.price != null ? String(p.price) : '',
    // Absent means the pre-migration default; treating it as 'fixed' is what the
    // NOT NULL DEFAULT 'fixed' column guarantees for every existing row.
    pricingMode: (p.pricingMode ?? 'fixed') as 'fixed' | 'from' | 'request',
    compareAtCents: p.compareAtPrice ? String(p.compareAtPrice) : '',
    currency: p.currency ?? 'SAR',
    inventory: String(p.inventory ?? 0),
    trackInventory: p.trackInventory ?? true,
    allowBackorder: p.allowBackorder ?? false,
    isDigital: p.isDigital ?? false,
    featured: p.featured ?? false,
    sortOrder: String(p.sortOrder ?? 0),
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
    features: Array.isArray(p.features) ? p.features.join('\n') : '',
    academyId: p.academyId ?? '',
    courseId: p.courseId ?? '',
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    thumbnailUrl: p.thumbnailUrl ?? null,
    pinpoints: mergedPins,
    documents: (p as any).documents ?? [],
    translationsAr: {
      title: p.translations?.ar?.title ?? '',
      tagline: p.translations?.ar?.tagline ?? '',
      description: p.translations?.ar?.description ?? '',
      features: Array.isArray(p.translations?.ar?.features)
        ? p.translations.ar.features!.join('\n')
        : '',
      seoTitle: p.translations?.ar?.seoTitle ?? '',
      seoDescription: p.translations?.ar?.seoDescription ?? '',
      hotspots: Object.fromEntries(
        Object.entries(p.translations?.ar?.hotspots ?? {}).map(([id, copy]) => [
          id,
          { label: copy?.label ?? '', tooltip: copy?.tooltip ?? '', detail: copy?.detail ?? '' },
        ]),
      ),
    },
  };
}

export default function ProductEditorPage() {
  const t = useTranslations('admin.productForm');
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [baseline, setBaseline] = useState<ProductFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  /** Blocks save while any upload is still in flight, so a save can't race one. */
  const [uploadingCount, setUploadingCount] = useState(0);
  const beginUpload = useCallback(() => setUploadingCount((n) => n + 1), []);
  const endUpload = useCallback(() => setUploadingCount((n) => Math.max(0, n - 1)), []);

  const { value, set, reset } = useProductForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/products/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ProductDetail = await res.json();
      const next = baselineOf(data);
      setProduct(data);
      setBaseline(next);
      setImages(Array.isArray(data.images) ? data.images : []);
      /**
       * Populate the form. This line is the entire data-loss fix.
       *
       * It was missing: `baseline` was set but the form state was never seeded, so
       * `value` stayed at empty defaults while `dirty` immediately compared
       * "empty" against "the real product" and reported true. The admin was shown a
       * blank form with Save enabled, and saving sent every field empty — which
       * nulled title, description, price, thumbnail, pinpoints and documents, and left
       * `slug` as '' so the product then 404'd on every subsequent save.
       */
      reset(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadFailed', { default: 'Failed to load' }));
    } finally {
      setLoading(false);
    }
  }, [slug, t, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = baseline ? JSON.stringify(value) !== JSON.stringify(baseline) : false;

  const save = useCallback(async () => {
    // Guard the in-flight request, not just the button's disabled prop: a double
    // click can dispatch twice before React re-renders, and two concurrent saves of a
    // stale payload is exactly how one clobbers the other.
    if (!product || !dirty || saving) return;
    if (uploadingCount > 0) {
      toast({ type: 'err', title: t('waitForUploads') });
      return;
    }
    setSaving(true);
    try {
      let updated: ProductDetail | undefined;
      try {
        updated = await api.patch<ProductDetail>(`/admin/products/${slug}`, {
          ...productFormPayload(value),
          // Optimistic lock: the version we loaded. If someone else saved in the
          // meantime the server answers 409 instead of silently overwriting them.
          expectedUpdatedAt: product.updatedAt,
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 409) throw err;
        // Preserve what the user typed. Discarding their edits because of a conflict
        // is its own data loss.
        const body = (err as { body?: { message?: string } }).body;
        setError(
          body?.message ??
            t('saveConflict', {
              default: 'This product changed since you opened it. Reload before saving.',
            }),
        );
        return;
      }
      toast({ type: 'ok', title: t('saved', { default: 'Product saved' }) });
      // A slug change moves the record to a new URL; follow it.
      if (updated?.slug && updated.slug !== slug) {
        router.replace(`/admin/products/${updated.slug}/edit`);
      } else if (updated) {
        /**
         * Rehydrate from the RESPONSE, not from local state. The server is the only
         * authority on what was stored; trusting local state after a save is how a
         * second save sends stale or half-applied values.
         */
        const next = baselineOf(updated as ProductDetail);
        reset(next);
        setProduct(updated as ProductDetail);
        setBaseline(next);
      } else {
        void load();
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t('saveFailedGeneric', { default: 'Save failed' });
      toast({
        type: 'err',
        title: t('saveFailedGeneric', { default: 'Save failed' }),
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }, [product, dirty, saving, uploadingCount, value, slug, router, load, t, reset]);

  const togglePublish = async () => {
    if (!product) return;
    setPublishing(true);
    try {
      const action = product.isPublished ? 'unpublish' : 'publish';
      await api.post(`/admin/products/${slug}/${action}`);
      toast({
        type: 'ok',
        title: t(action === 'publish' ? 'published' : 'unpublished', {
          default: action === 'publish' ? 'Product published' : 'Product unpublished',
        }),
      });
      void load();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t('actionFailed', { default: 'Action failed' });
      toast({
        type: 'err',
        title: t('actionFailed', { default: 'Action failed' }),
        description: message,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    const ok = window.confirm(
      t('confirmDelete', {
        title: product.title,
        default: 'Delete "{title}"? This cannot be undone.',
      }),
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/admin/products/${slug}`);
      toast({ type: 'ok', title: t('deleted', { default: 'Product deleted' }) });
      router.push('/admin/products');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t('deleteFailed', { default: 'Delete failed' });
      toast({
        type: 'err',
        title: t('deleteFailed', { default: 'Delete failed' }),
        description: message,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pt-6">
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-balance font-display text-xl font-medium tracking-[-0.015em] text-foreground">
          {error || t('notFound', { default: 'Product not found' })}
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
        >
          {t('backToProducts', { default: 'Back to products' })}
        </button>
      </div>
    );
  }

  const statusTone = product.isArchived ? 'archived' : product.isPublished ? 'live' : 'draft';
  const statusLabel = product.isArchived
    ? t('status.archived')
    : product.isPublished
      ? t('status.published')
      : t('status.draft');
  const tt = t as unknown as (key: string) => string;
  const checks = productReadinessChecks(tt, value);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: t('productsCrumb', { default: 'Products' }), href: '/admin/products' },
          { label: product.title },
        ]}
        live={product.isPublished && !product.isArchived ? t('live', { default: 'Live' }) : false}
        actions={
          <>
            <BarButton
              icon={product.isPublished ? <GlobeLock className="size-4" /> : <Globe className="size-4" />}
              disabled={publishing}
              onClick={() => void togglePublish()}
            >
              {publishing
                ? t('working', { default: 'Working…' })
                : t(product.isPublished ? 'unpublish' : 'publish', {
                    default: product.isPublished ? 'Unpublish' : 'Publish',
                  })}
            </BarButton>
            <BarButton
              icon={<Trash2 className="size-4" />}
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {t('delete', { default: 'Delete' })}
            </BarButton>
          </>
        }
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <AdminPageHeader
            title={product.title}
            description={`/${product.slug}${product.category ? ` · ${product.category}` : ''}${
              product.productType ? ` · ${product.productType}` : ''
            } · ${
              product.pricingMode === 'request'
                ? t('pricingRequest', { default: 'Request a quote' })
                : formatMoney(product.price, product.currency)
            }`}
            badge={<StatusChip tone={statusTone}>{statusLabel}</StatusChip>}
          />
          {error && <ErrorBanner message={error} onRetry={() => load()} />}
        </div>

        <FormLayout
          aside={
            <>
              <SectionNav items={productSectionItems(tt)} />
              <PublishReadiness checks={checks} />
            </>
          }
        >
          <PublishReadiness checks={checks} className="xl:hidden" />
          <ProductFormSections
            value={value}
            set={set}
            mode="edit"
            gallery={
              <ProductGalleryManager
                slug={product.slug}
                images={images}
                onChange={setImages}
                onUploadStart={beginUpload}
                onUploadEnd={endUpload}
              />
            }
          />
        </FormLayout>
      </div>

      <SaveDock
        mode="edit"
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={baseline ? () => reset(baseline) : undefined}
        saveLabel={t('saveChanges', { default: 'Save changes' })}
        savingLabel={t('saving', { default: 'Saving…' })}
      />
    </div>
  );
}
