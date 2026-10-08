'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { FormActions } from '@/components/admin/admin-form';
import {
  ProductFormSections,
  PublishReadiness,
  productFormPayload,
  slugify,
  useProductForm,
} from '../product-form';

export default function NewProductPage() {
  const t = useTranslations('admin.productForm');
  const router = useRouter();
  const { value, set } = useProductForm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="space-y-5">
          <ProductFormSections value={value} set={set} />
        </div>
        <FormActions
          saving={busy}
          onSave={() => void submit()}
          onCancel={() => router.push('/admin/products')}
          saveLabel={t('createProduct', { default: 'Create product' })}
          cancelLabel={t('cancel', { default: 'Cancel' })}
        >
          <span className="sr-only">{slugify(value.title)}</span>
        </FormActions>
      </div>
    </div>
  );
}
