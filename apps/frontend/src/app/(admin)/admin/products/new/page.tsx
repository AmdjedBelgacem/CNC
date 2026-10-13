'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { TextField, TextAreaField } from '@/components/admin/admin-form';
import {
  TranslateAction,
  TranslationCoveragePanel,
  useTranslateDraft,
} from '@/components/admin/translation';
import {
  PRODUCT_FIELDS,
  HOTSPOT_FIELDS,
  coverageOf,
  type TranslationCoverage,
} from '@titan/shared';
import {
  ProductFormSections,
  PublishReadiness,
  productFormPayload,
  useProductForm,
} from '../product-form';

export default function NewProductPage() {
  const t = useTranslations('admin.productForm');
  const router = useRouter();
  const { value, set } = useProductForm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tTranslate = useTranslations('admin.translate');

  const translateGroups = useMemo(() => {
    const main: Record<string, string> = {
      Title: value.title,
      Tagline: value.tagline,
      Description: value.description,
      'Bullet points (one per line)': value.features,
      'SEO title': value.seoTitle,
      'SEO description': value.seoDescription,
    };
    const groups: Array<{ key: string; fields: Record<string, string> }> = [{ key: 'product', fields: main }];
    for (const pin of value.pinpoints) {
      groups.push({
        key: `pin:${pin.id}`,
        fields: { Label: pin.label, Tooltip: pin.tooltip ?? '', Detail: pin.detail ?? '' },
      });
    }
    return groups;
  }, [value.title, value.tagline, value.description, value.features, value.seoTitle, value.seoDescription, value.pinpoints]);

  const { busy: translateBusy, run: runTranslate, coverageFor } = useTranslateDraft({
    entity: 'product copy',
    descriptors: PRODUCT_FIELDS,
    groups: translateGroups,
    onApply: (key, translations) => {
      if (key.startsWith('pin:')) {
        const id = key.slice('pin:'.length);
        const current = value.translationsAr.hotspots[id] ?? { label: '', tooltip: '', detail: '' };
        set('translationsAr', {
          ...value.translationsAr,
          hotspots: {
            ...value.translationsAr.hotspots,
            [id]: {
              label: translations['Label'] ?? current.label,
              tooltip: translations['Tooltip'] ?? current.tooltip,
              detail: translations['Detail'] ?? current.detail,
            },
          },
        });
        return;
      }
      set('translationsAr', {
        ...value.translationsAr,
        title: translations['Title'] ?? value.translationsAr.title,
        tagline: translations['Tagline'] ?? value.translationsAr.tagline,
        description: translations['Description'] ?? value.translationsAr.description,
        features: translations['Bullet points (one per line)'] ?? value.translationsAr.features,
        seoTitle: translations['SEO title'] ?? value.translationsAr.seoTitle,
        seoDescription: translations['SEO description'] ?? value.translationsAr.seoDescription,
      });
    },
    confirmOverwrite: () => window.confirm(tTranslate('overwriteConfirm')),
  });

  const productCoverage = coverageFor(value, value.translationsAr);
  const hotspotCoverage = value.pinpoints.map((pin) => ({
    pin,
    coverage: coverageOf(pin, value.translationsAr.hotspots?.[pin.id] ?? null, HOTSPOT_FIELDS),
  }));
  const totalProductCoverage = useMemo<TranslationCoverage | undefined>(() => {
    if (!productCoverage) return undefined;
    let translated = productCoverage.translated;
    let total = productCoverage.total;
    const missing = [...productCoverage.missing];
    for (const entry of hotspotCoverage) {
      total += entry.coverage.total;
      translated += entry.coverage.translated;
      missing.push(...entry.coverage.missing);
    }
    return { total, translated, missing, present: [] };
  }, [productCoverage, hotspotCoverage]);

  const priceText = value.priceCents.trim();
  const valid = value.title.trim().length > 0 && (priceText === '' || (Number.isFinite(Number(priceText)) && Number(priceText) >= 0));

  const submit = async () => {
    if (!value.title.trim()) {
      toast({ type: 'err', title: t('titleRequired', { default: 'Title required' }) });
      return;
    }
    if (priceText !== '' && (!Number.isFinite(Number(priceText)) || Number(priceText) < 0)) {
      toast({ type: 'err', title: t('priceRequired', { default: 'Price must be a number' }) });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = productFormPayload(value);
      const created = await api.post<{ slug?: string }>('/admin/products', body);
      toast({ type: 'ok', title: t('created', { default: 'Product created' }) });
      /**
       * Hand over to the editor rather than staying on a form that cannot manage the
       * gallery. The editor seeds itself from the server response, which is the same
       * path every later save takes.
       */
      router.replace(`/admin/products/${created?.slug ?? body.slug}/edit`);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('createFailedGeneric', { default: 'Create failed' });
      setError(message);
      toast({ type: 'err', title: t('createFailedGeneric', { default: 'Create failed' }), description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: t('productsCrumb', { default: 'Products' }), href: '/admin/products' },
          { label: t('newProduct', { default: 'New product' }) },
        ]}
        live={t('live', { default: 'Live' })}
        actions={
          <BarButton onClick={() => router.push('/admin/products')}>
            {t('cancel', { default: 'Cancel' })}
          </BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={busy ? <Loader2 className="size-4 animate-spin" /> : undefined}
            disabled={busy || !valid}
            onClick={() => void submit()}
          >
            {busy ? t('creating', { default: 'Creating…' }) : t('createProduct', { default: 'Create product' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 pt-6">
        <AdminPageHeader
          title={t('newProduct', { default: 'New product' })}
          description={t('newDescription', { default: 'Create a new product for your catalog.' })}
        />
        <PublishReadiness
          checks={[
            { label: t('readinessTitle'), ok: !!value.title.trim() },
            { label: t('readinessSlug'), ok: !!value.slug.trim() },
            { label: t('readinessDescription'), ok: !!value.description.trim() },
            { label: t('readinessCategory'), ok: !!value.category.trim() },
            { label: t('readinessThumbnail'), ok: !!value.thumbnailUrl },
            { label: t('readinessPrice'), ok: value.priceCents.trim() !== '' && Number(value.priceCents) > 0 },
          ]}
        />
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-13 font-medium text-destructive"
          >
            {error}
          </div>
        )}
        {/* Two columns, matching the academies create screen. Seven stacked full-width
            sections turned this into an endless scroll on a laptop. */}
        <ProductFormSections value={value} set={set} columns={2} />
        <div className="rounded-2xl border border-border bg-card p-4" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('arabicCopy', { default: 'Arabic copy' })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('arabicCopyHint', {
                  default: 'Shown to Arabic visitors. Leave blank to fall back to English.',
                })}
              </p>
            </div>
            <TranslateAction
              coverage={totalProductCoverage}
              busy={translateBusy}
              onTranslate={(scope) => void runTranslate(scope)}
            />
          </div>
          {totalProductCoverage && (
            <TranslationCoveragePanel coverage={totalProductCoverage} className="mt-3" />
          )}
          <div className="mt-4 grid gap-4">
            <TextField
              label={t('arabicTitle', { default: 'Arabic title' })}
              value={value.translationsAr.title}
              onChange={(e) =>
                set('translationsAr', { ...value.translationsAr, title: e.target.value })
              }
            />
            <TextField
              label={t('arabicTagline', { default: 'Arabic tagline' })}
              value={value.translationsAr.tagline}
              onChange={(e) =>
                set('translationsAr', { ...value.translationsAr, tagline: e.target.value })
              }
            />
            <TextAreaField
              label={t('arabicDescription', { default: 'Arabic description' })}
              value={value.translationsAr.description}
              onChange={(e) =>
                set('translationsAr', { ...value.translationsAr, description: e.target.value })
              }
              rows={5}
            />
            <TextAreaField
              label={t('arabicFeatures', { default: 'Arabic bullet points (one per line)' })}
              value={value.translationsAr.features}
              onChange={(e) =>
                set('translationsAr', { ...value.translationsAr, features: e.target.value })
              }
              rows={4}
            />
          </div>
        </div>
        {/* Mirrors the academies create screen: a plain action row at the foot, repeated
            from the command bar. Deliberately not the shared FormActions — that component
            reports "All changes saved", which is false here, because a product that has not
            been created has never been saved at all. */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t('cancel', { default: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !valid}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50',
              busy || !valid ? 'bg-muted-foreground/40' : 'bg-primary shadow-xs hover:bg-primary/90',
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? t('creating', { default: 'Creating…' }) : t('createProduct', { default: 'Create product' })}
          </button>
        </div>
      </div>
    </div>
  );
}
