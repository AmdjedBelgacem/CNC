'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Globe, GlobeLock, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/api/normalize';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { FormActions, FormSkeleton } from '@/components/admin/admin-form';
import { ErrorBanner, StatusPill } from '@/components/admin/admin-ui';
import {
  ProductFormSections,
  productFormPayload,
  useProductForm,
  type ProductFormValue,
} from '../../product-form';

interface ProductDetail {
  id: string; slug: string; title: string; tagline: string | null;
  description: string | null; features: string[] | null;
  thumbnailUrl: string | null; mediaUrls: string[] | null;
  price: number; compareAtPrice: number | null; currency: string;
  inventory: number | null; trackInventory: boolean; allowBackorder: boolean;
  backorderLeadDays: number | null; isDigital: boolean;
  isPublished: boolean; isArchived: boolean; featured: boolean;
  category: string | null; tags: string[] | null;
  sortOrder: number | null; academyId: string | null; courseId: string | null;
  seoTitle: string | null; seoDescription: string | null;
  updatedAt: string;
  academy?: { id: string; title: string; slug: string } | null;
  course?: { id: string; title: string; slug: string } | null;
  variants?: unknown[];
}

/** The form value that a saved product corresponds to, used for dirty tracking. */
function baselineOf(p: ProductDetail): ProductFormValue {
  return {
    title: p.title ?? '',
    slug: p.slug ?? '',
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    priceCents: String(p.price ?? ''),
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

  const { value, set, reset } = useProductForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/products/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ProductDetail = await res.json();
      setProduct(data);
      setBaseline(baselineOf(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadFailed', { default: 'Failed to load' }));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = baseline ? JSON.stringify(value) !== JSON.stringify(baseline) : false;

  const save = useCallback(async () => {
    if (!product || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/proxy/admin/products/${slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productFormPayload(value)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? t('saveFailed', { status: res.status, default: 'Save failed ({status})' }));
      }
      const updated = await res.json();
      toast({ type: 'ok', title: t('saved', { default: 'Product saved' }) });
      // A slug change moves the record to a new URL; follow it.
      if (updated?.slug && updated.slug !== slug) {
        router.replace(`/admin/products/${updated.slug}/edit`);
      } else {
        void load();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('saveFailedGeneric', { default: 'Save failed' });
      toast({ type: 'err', title: t('saveFailedGeneric', { default: 'Save failed' }), description: message });
    } finally {
      setSaving(false);
    }
  }, [product, dirty, value, slug, router, load, t]);

  const togglePublish = async () => {
    if (!product) return;
    setPublishing(true);
    try {
      const action = product.isPublished ? 'unpublish' : 'publish';
      const res = await fetch(`/api/proxy/admin/products/${slug}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.message ??
            data?.reasons?.join('; ') ??
            t('loadFailed', { status: res.status, default: 'Request failed ({status})' }),
        );
      }
      toast({
        type: 'ok',
        title: t(action === 'publish' ? 'published' : 'unpublished', {
          default: action === 'publish' ? 'Product published' : 'Product unpublished',
        }),
      });
      void load();
    } catch (e) {
      const message = e instanceof Error ? e.message : t('actionFailed', { default: 'Action failed' });
      toast({ type: 'err', title: t('actionFailed', { default: 'Action failed' }), description: message });
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    const ok = window.confirm(
      t('confirmDelete', { title: product.title, default: 'Delete "{title}"? This cannot be undone.' }),
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/admin/products/${slug}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast({ type: 'ok', title: t('deleted', { default: 'Product deleted' }) });
      router.push('/admin/products');
    } catch (e) {
      const message = e instanceof Error ? e.message : t('deleteFailed', { default: 'Delete failed' });
      toast({ type: 'err', title: t('deleteFailed', { default: 'Delete failed' }), description: message });
    } finally {
      setBusy(false);
    }
  };

  // Cmd/Ctrl+S saves, but never while focus is inside a text field where the
  // browser's own save shortcut is expected to behave normally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-6 pt-6">
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base text-foreground">
          {error || t('notFound', { default: 'Product not found' })}
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary"
        >
          {t('backToProducts', { default: 'Back to products' })}
        </button>
      </div>
    );
  }

  const statusKey = product.isArchived ? 'archived' : product.isPublished ? 'published' : 'draft';

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: t('productsCrumb', { default: 'Products' }), href: '/admin/products' },
          { label: product.title },
        ]}
        live={t('live', { default: 'Live' })}
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
            <BarButton icon={<Trash2 className="size-4" />} disabled={busy} onClick={() => void handleDelete()}>
              {t('delete', { default: 'Delete' })}
            </BarButton>
          </>
        }
        primary={
          <BarPrimaryButton
            icon={<Save className="size-4" strokeWidth={2.5} />}
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? t('saving', { default: 'Saving…' }) : t('saveChanges', { default: 'Save changes' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] space-y-6 pt-6">
        <AdminPageHeader
          title={product.title}
          description={`/${product.slug} · ${formatMoney(product.price, product.currency)}`}
          badge={
            <StatusPill
              label={t(`status.${statusKey}`, { default: statusKey })}
              tone={statusKey === 'published' ? 'emerald' : statusKey === 'draft' ? 'amber' : 'slate'}
              pulse={statusKey === 'published'}
              className={cn('self-start md:self-auto')}
            />
          }
        />

        {error && <ErrorBanner message={error} onRetry={() => load()} />}

        <div className="space-y-5">
          <ProductFormSections value={value} set={set} />
        </div>

        <FormActions
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onReset={baseline ? () => reset(baseline) : undefined}
          onCancel={() => router.push('/admin/products')}
          saveLabel={t('saveChanges', { default: 'Save changes' })}
          resetLabel={t('discard', { default: 'Discard' })}
          cancelLabel={t('cancel', { default: 'Cancel' })}
        />
      </div>
    </div>
  );
}
