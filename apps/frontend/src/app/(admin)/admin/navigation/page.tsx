import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NavigationEditor } from '@/components/admin/navigation-editor';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.navigation');
  return { title: `${t('title')} | TITANS Admin` };
}

// The editor owns its own header, preview and save dock.
export default function AdminNavigationPage() {
  return <NavigationEditor />;
}
