import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { IntegrationsPanel } from './integrations-panel';
import { SkeletonCard } from '@/components/ui/skeleton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('integrations');
  const tAdmin = await getTranslations('admin.integrations');
  return {
    title: `${t('title')} | Baroot CNC Solutions`,
    description: tAdmin('metaDescription'),
  };
}

export default async function AdminIntegrationsPage() {
  const t = await getTranslations('integrations');
  const tAdmin = await getTranslations('admin.integrations');
  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader title={t('title')} description={tAdmin('description')} />
      {/* Was `fallback={null}`: the panel is the entire page body, so a null
          fallback left the user looking at a header above an empty void. */}
      <Suspense fallback={<IntegrationsSkeleton />}>
        <IntegrationsPanel />
      </Suspense>
    </div>
  );
}

/** One placeholder card per integration surface the panel can render. */
async function IntegrationsSkeleton() {
  const t = await getTranslations('admin.integrations');
  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} media={false} lines={3} />
      ))}
    </div>
  );
}
