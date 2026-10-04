'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { FormActions } from '@/components/admin/admin-form';
import {
  ProductFormSections,
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

  const valid = value.title.trim().length > 0 && Number(value.priceCents) > 0;

  const submit = async () => {
    if (!value.title.trim()) {
      toast({ type: 'err', title: t('titleRequired', { default: 'Title required' }) });
      return;
    }
    const price = Number(value.priceCents);
    if (!Number.isFinite(price) || price <= 0) {
      toast({ type: 'err', title: t('priceRequired', { default: 'Valid price required' }) });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = productFormPayload(value);
      const res = await fetch('/api/proxy/admin/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.message ?? t('createFailed', { status: res.status, default: 'Create failed ({status})' }),
        );
      }
      toast({ type: 'ok', title: t('created', { default: 'Product created' }) });
      router.replace(`/admin/products/${body.slug}/edit`);
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
