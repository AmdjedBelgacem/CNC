'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { ContentLocale, ProductContentTranslation } from '@titan/shared';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/api/normalize';
import { AdminCommandBar, BarButton } from '@/components/admin/admin-chrome';
import { SaveDock, useFormGuard } from '@/components/admin/form-page';
import {
  AsideCard,
  CheckList,
  EditorHeader,
  EditorLayout,
  EditorRail,
  LanguageModeProvider,
  SaveStateLine,
  useAutosave,
  useLanguageMode,
  useSaveState,
  type EditorCheck,
} from '@/components/admin/editor/editor-kit';
import { PublishSheet } from '@/components/admin/editor/publish-sheet';
import { ErrorBanner } from '@/components/admin/admin-ui';
import {
  ProductCardPreview,
  ProductFormSections,
  productFormPayload,
  productRailSections,
  productReadinessChecks,
  useProductArabic,
  useProductForm,
  type ProductFormValue,
} from '../../product-form';
import type { InteractiveHotspot } from '@titan/shared';
import { ProductGalleryManager } from '../../product-gallery';
import { ProductEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { rememberListCount } from '@/lib/admin-shape-memory';

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
  return (
    <LanguageModeProvider>
      <ProductEditor />
    </LanguageModeProvider>
  );
}

function ProductEditor() {
  const t = useTranslations('admin.productForm');
  const tk = useTranslations('admin.editorKit');
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [baseline, setBaseline] = useState<ProductFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  /** Blocks save while any upload is still in flight, so a save can't race one. */
  const [uploadingCount, setUploadingCount] = useState(0);
  const beginUpload = useCallback(() => setUploadingCount((n) => n + 1), []);
  const endUpload = useCallback(() => setUploadingCount((n) => Math.max(0, n - 1)), []);

  const { value, set, reset } = useProductForm();
  const arabic = useProductArabic(value, set);
  /** The form as it is now, read after an await to see whether the user kept typing. */
  const valueRef = useRef(value);
  valueRef.current = value;

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
      // The editor's data-sized parts, so the loading skeleton can draw them next time.
      rememberListCount('edit-product-images', Array.isArray(data.images) ? data.images.length : 0);
      rememberListCount('edit-product-pinpoints', next.pinpoints.length);
      rememberListCount('edit-product-documents', next.documents.length);
      rememberListCount('edit-product-thumbnail', next.thumbnailUrl ? 1 : 0);
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

  const fingerprint = JSON.stringify(value);
  const dirty = baseline ? fingerprint !== JSON.stringify(baseline) : false;
  const live = !!product?.isPublished && !product?.isArchived;

  /** Returns false when nothing was stored, so autosave can show the failure. */
  const save = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}): Promise<boolean> => {
      // Guard the in-flight request, not just the button's disabled prop: a double
      // click can dispatch twice before React re-renders, and two concurrent saves of a
      // stale payload is exactly how one clobbers the other.
      if (!product || !dirty || saving) return true;
      if (uploadingCount > 0) {
        if (!quiet) toast({ type: 'err', title: t('waitForUploads') });
        return true;
      }
      if (!value.title.trim()) return true;
      setSaving(true);
      const sent = JSON.stringify(value);
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
          setSaveFailed(true);
          return false;
        }
        setSaveFailed(false);
        if (!quiet) toast({ type: 'ok', title: t('saved', { default: 'Product saved' }) });
        // A slug change moves the record to a new URL; follow it.
        if (updated?.slug && updated.slug !== slug) {
          router.replace(`/admin/products/${updated.slug}/edit`);
        } else if (updated) {
          /**
           * Rehydrate from the RESPONSE, not from local state. The server is the only
           * authority on what was stored; trusting local state after a save is how a
           * second save sends stale or half-applied values.
           *
           * Except when the user kept typing while the request was in flight: the
           * baseline still moves to what was stored, but their newer edits stay on
           * screen (and read as unsaved, so the next autosave sends them).
           */
          const next = baselineOf(updated as ProductDetail);
          setProduct(updated as ProductDetail);
          setBaseline(next);
          if (JSON.stringify(valueRef.current) === sent) reset(next);
        } else {
          void load();
        }
        return true;
      } catch (e) {
        setSaveFailed(true);
        if (!quiet) {
          const message = e instanceof Error ? e.message : t('saveFailedGeneric', { default: 'Save failed' });
          toast({ type: 'err', title: t('saveFailedGeneric', { default: 'Save failed' }), description: message });
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [product, dirty, saving, uploadingCount, value, slug, router, load, t, reset],
  );

  // Drafts save themselves; a live product waits for Save so visitors never see a
  // half-typed edit.
  useAutosave({
    enabled: !!product && !live && uploadingCount === 0,
    dirty,
    saving,
    save: () => save({ quiet: true }),
    fingerprint,
  });
  useFormGuard({ dirty: !live && dirty, saving, onSave: () => void save() });
  const saveState = useSaveState({ dirty, saving, failed: saveFailed });

  const setPublished = async (publish: boolean) => {
    if (!product) return;
    setPublishing(true);
    try {
      // Publishing what is on screen, not what was last stored.
      if (dirty && !(await save({ quiet: true }))) return;
      const action = publish ? 'publish' : 'unpublish';
      await api.post(`/admin/products/${slug}/${action}`);
      toast({
        type: 'ok',
        title: t(publish ? 'published' : 'unpublished', {
          default: publish ? 'Product published' : 'Product unpublished',
        }),
      });
      setReviewOpen(false);
      void load();
    } catch (e) {
      // The server lists why it refused; show those rather than its generic headline.
      const reasons = (e as { body?: { reasons?: string[] } }).body?.reasons;
      const message = Array.isArray(reasons) && reasons.length
        ? reasons.join(' · ')
        : e instanceof Error
          ? e.message
          : t('actionFailed', { default: 'Action failed' });
      toast({ type: 'err', title: t('actionFailed', { default: 'Action failed' }), description: message });
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
      const message = e instanceof Error ? e.message : t('deleteFailed', { default: 'Delete failed' });
      toast({ type: 'err', title: t('deleteFailed', { default: 'Delete failed' }), description: message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <ProductEditorSkeleton />;
  }

  if (!product) {
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
  const readiness = productReadinessChecks(tt, value);
  /**
   * What the server refuses to publish without (products.service `publish`): a title,
   * an address and a thumbnail, and a price above zero when one is set. The rest are
   * advice. "Price set" is held to the storefront's need instead: a fixed-price product
   * with no price cannot be bought.
   */
  const REQUIRED = new Set(['pf-title', 'basics', 'pf-thumbnail', 'pf-price']);
  const checks: EditorCheck[] = readiness.map((c) => ({
    label: c.label,
    ok: c.ok,
    target: c.target,
    optional: !REQUIRED.has(c.target),
  }));
  const coverage = arabic.coverage;
  const asideChecks: EditorCheck[] =
    coverage && coverage.total > 0
      ? [
          ...checks,
          {
            label: tk('publish.arabicCoverage', { translated: coverage.translated, total: coverage.total }),
            ok: coverage.translated >= coverage.total,
            target: 'pf-title',
            optional: true,
          },
        ]
      : checks;
  const blocked = checks.some((c) => !c.ok && !c.optional);
  const done = readiness.filter((c) => c.ok).length;

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: t('productsCrumb', { default: 'Products' }), href: '/admin/products' },
          { label: product.title },
        ]}
        live={live ? t('live', { default: 'Live' }) : false}
        actions={
          <BarButton icon={<Trash2 className="size-4" />} disabled={busy} onClick={() => void handleDelete()}>
            {t('delete', { default: 'Delete' })}
          </BarButton>
        }
      />

      <EditorHeader
        status={{ tone: statusTone, label: statusLabel }}
        saveLine={<SaveStateLine state={saveState} autosave={!live} onRetry={() => void save()} />}
        title={value.title.trim() || product.title}
        subtitle={
          <span dir="ltr">
            barootcnc.com/products/<span className="font-mono text-foreground">{product.slug}</span>
            {product.category ? ` · ${product.category}` : ''}
            {' · '}
            {product.pricingMode === 'request'
              ? t('pricingRequest', { default: 'Request a quote' })
              : formatMoney(product.price, product.currency)}
          </span>
        }
        previewHref={`/products/${product.slug}`}
        onReview={() => setReviewOpen(true)}
        reviewLabel={live ? tk('reviewLive') : tk('reviewAndPublish')}
      />
      {error && (
        <div className="mx-auto mb-4 w-full max-w-[90rem]">
          <ErrorBanner message={error} onRetry={() => load()} />
        </div>
      )}

      <EditorLayout
        rail={
          <EditorRail
            sections={productRailSections(tt, value, arabic)}
            readiness={{ done, total: readiness.length, note: live ? tk('liveNote') : tk('draftNote') }}
          />
        }
        aside={
          <>
            <AsideCard eyebrow={t('storeCard')} meta={<LanguageHint />}>
              <ProductCardPreview value={value} />
              <a
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 text-13 font-medium text-primary hover:underline"
              >
                {t('viewPage')}
                <ExternalLink className="size-3.5" />
              </a>
            </AsideCard>
            <AsideCard title={tk('beforePublish')}>
              <CheckList checks={asideChecks} />
            </AsideCard>
          </>
        }
      >
        <ProductFormSections
          value={value}
          set={set}
          mode="edit"
          arabic={arabic}
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
      </EditorLayout>

      {live && (
        <SaveDock
          mode="edit"
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={baseline ? () => reset(baseline) : undefined}
          saveLabel={t('saveChanges', { default: 'Save changes' })}
          savingLabel={t('saving', { default: 'Saving…' })}
        />
      )}

      <PublishSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        eyebrow={`${t('productsCrumb', { default: 'Products' })} · ${product.title}`}
        title={live ? tk('publish.unpublish') + ' · ' + (value.title.trim() || product.title) : value.title.trim() || product.title}
        checks={checks}
        arabic={
          coverage
            ? { translated: coverage.translated, total: coverage.total, onDraft: () => void arabic.run('missing'), drafting: arabic.busy }
            : undefined
        }
        arabicPreview={
          <>
            <span className="text-lg text-foreground">{value.translationsAr.title.trim() || value.title}</span>
            <span className="text-13 text-muted-foreground">{value.translationsAr.tagline.trim() || value.tagline}</span>
          </>
        }
        isPublished={live}
        busy={publishing}
        blocked={blocked}
        onPublish={() => void setPublished(true)}
        onUnpublish={() => void setPublished(false)}
      />
    </div>
  );
}

function LanguageHint() {
  const tk = useTranslations('admin.editorKit');
  const { mode } = useLanguageMode();
  return <span>{mode === 'ar' ? 'العربية' : tk('modeEnglish')}</span>;
}
