import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmailTemplateEditor } from '@/components/admin/email-template-editor';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.email');
  return { title: `${t('editor')} | Baroot Admin` };
}

export default async function AdminEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmailTemplateEditor templateId={id} />;
}
