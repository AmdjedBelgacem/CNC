import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmailTemplatesList } from '@/components/admin/email-templates-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.email');
  return { title: `${t('templatesTitle')} | Baroot Admin` };
}

export default async function AdminEmailPage() {
  return <EmailTemplatesList />;
}
