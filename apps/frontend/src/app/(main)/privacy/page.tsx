import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'Privacy Policy | Baroot CNC Solutions',
  description:
    'Read our privacy policy to understand how we collect, use, and protect your personal information.',
  alternates: { canonical: '/privacy' },
};
export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'privacy');
  return <BlockRenderer layout={layout} />;
}
