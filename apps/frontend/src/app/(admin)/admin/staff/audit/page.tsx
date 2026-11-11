import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { SkeletonCard } from '@/components/ui/skeleton';
import { AuditLog } from './audit-log';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.auditLog');
  return { title: t('title') };
}

export default async function AdminAuditLogPage() {
  const t = await getTranslations('admin.auditLog');
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <AdminPageHeader title={t('title')} description={t('description')} />
      <Suspense fallback={<SkeletonCard />}>
        <AuditLog />
      </Suspense>
    </div>
  );
}
