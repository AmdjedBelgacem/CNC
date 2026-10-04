import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { NavigationEditor } from '@/components/admin/navigation-editor';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.navigation');
  return { title: `${t('title')} | TITANS Admin` };
}

export default async function AdminNavigationPage() {
  const t = await getTranslations('admin.navigation');
  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('title')} description={t('description')} />
      <NavigationEditor />
    </div>
  );
}
