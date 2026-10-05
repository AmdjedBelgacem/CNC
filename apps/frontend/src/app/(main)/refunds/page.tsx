import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'Refund Policy | Baroot CNC Solutions',
  description:
    'Our refund and return policy for digital courses, physical products, and institutional purchases.',
  alternates: { canonical: '/refunds' },
};
export default async function RefundsPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'refunds');
  return <BlockRenderer layout={layout} />;
}
