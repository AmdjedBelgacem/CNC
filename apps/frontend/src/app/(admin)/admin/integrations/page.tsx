import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { IntegrationsPanel } from './integrations-panel';
import { IntegrationsPanelSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { SkeletonRegion } from '@/components/ui/skeletons';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('integrations');
  const tAdmin = await getTranslations('admin.integrations');
  return {
    title: t('title'),
    description: tAdmin('metaDescription'),
  };
}

export default async function AdminIntegrationsPage() {
  const t = await getTranslations('integrations');
  const tAdmin = await getTranslations('admin.integrations');
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <AdminPageHeader title={t('title')} description={tAdmin('description')} />
      {/* Was `fallback={null}`: the panel is the entire page body, so a null
          fallback left the user looking at a header above an empty void. */}
      <Suspense
        fallback={
          <SkeletonRegion>
            <IntegrationsPanelSkeleton />
          </SkeletonRegion>
        }
      >
        <IntegrationsPanel />
      </Suspense>
    </div>
  );
}
