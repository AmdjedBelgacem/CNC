import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { SkeletonCard } from '@/components/ui/skeleton';
import { QuotesInbox } from './quotes-inbox';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.quotes');
  return { title: t('title') };
}

export default async function AdminQuotesPage() {
  const t = await getTranslations('admin.quotes');
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <AdminPageHeader title={t('title')} description={t('description')} />
      {/* The inbox is the whole page body, so a null fallback would leave a header above
          an empty void. */}
      <Suspense fallback={<SkeletonCard />}>
        <QuotesInbox />
      </Suspense>
    </div>
  );
}