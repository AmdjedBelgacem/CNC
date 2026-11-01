'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { api } from '@/lib/api-client';
import { AdminCommandBar, AdminPageHeader } from '@/components/admin/admin-chrome';
import { FormLayout, SaveDock, SectionNav, StatusChip } from '@/components/admin/form-page';
import {
  ProductFormSections,
  PublishReadiness,
  firstInvalidSection,
  productFormPayload,
  productReadinessChecks,
  productSectionItems,
  useProductForm,
  validateProduct,
} from '../product-form';

export default function NewProductPage() {
  const t = useTranslations('admin.productForm');
  const tForm = useTranslations('ui.adminForm');
  const tt = t as unknown as (key: string) => string;
  const router = useRouter();
  const { value, set } = useProductForm();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors only appear after the first attempt, so the form is not red on arrival.
  const [attempted, setAttempted] = useState(false);

  const liveErrors = validateProduct(value, tt);
  const canSave = Object.keys(liveErrors).length === 0;
  const errors = attempted ? liveErrors : {};
  const checks = productReadinessChecks(tt, value);

  const submit = async () => {
    setAttempted(true);
    if (!canSave) {
      // Bring the first problem into view rather than leaving the author to hunt for it.
      const section = firstInvalidSection(liveErrors);
      if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast({ type: 'err', title: liveErrors.title ?? liveErrors.price ?? '' });
      return;
    }
    setBusy(true);
    setFailed(false);
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
      setFailed(true);
      setError(message);
      toast({ type: 'err', title: t('createFailedGeneric', { default: 'Create failed' }), description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="w-full"
      onKeyDown={(e) => {
        // Enter in a single-line field attempts the create, which is also how an empty form
        // reveals what is missing (the Create button itself stays disabled until it is valid).
        const target = e.target;
        if (
          e.key === 'Enter' &&
          target instanceof HTMLInputElement &&
          (target.type === 'text' || target.type === 'number') &&
          !busy
        ) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <AdminCommandBar
        trail={[
          { label: t('productsCrumb', { default: 'Products' }), href: '/admin/products' },
          { label: t('newProduct', { default: 'New product' }) },
        ]}
        // A record that does not exist yet is not "Live"; the page header carries a `New` chip.
        live={false}
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <AdminPageHeader
            title={t('newProduct', { default: 'New product' })}
            description={t('newDescription', { default: 'Create a new product for your catalog.' })}
            badge={<StatusChip tone="new">{tForm('statusNew')}</StatusChip>}
          />
        </div>

        <FormLayout
          aside={
            <>
              <SectionNav items={productSectionItems(tt, errors)} />
              <PublishReadiness checks={checks} />
            </>
          }
        >
          <PublishReadiness checks={checks} className="xl:hidden" />
          <AnimatePresence initial={false}>
            {error && (
              <m.div
                key="error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                exit={{ opacity: 0, y: -4, transition: transition.leave }}
                className="rounded-2xl border border-destructive/20 bg-destructive/8 px-5 py-3.5 text-13 font-medium text-destructive"
              >
                {error}
              </m.div>
            )}
          </AnimatePresence>
          <ProductFormSections value={value} set={set} mode="create" errors={errors} />
        </FormLayout>
      </div>

      <SaveDock
        mode="create"
        saving={busy}
        failed={failed}
        canSave={canSave}
        onSave={() => void submit()}
        onCancel={() => router.push('/admin/products')}
        saveLabel={busy ? t('creating', { default: 'Creating…' }) : t('createProduct', { default: 'Create product' })}
        savingLabel={t('creating', { default: 'Creating…' })}
      />
    </div>
  );
}
