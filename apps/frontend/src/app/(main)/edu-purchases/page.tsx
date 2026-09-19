import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'Educational & Institutional Purchases | TITANS of Manufacturing',
  description:
    'Discounted academic pricing and institutional licensing for schools, colleges, and training centers.',
  alternates: { canonical: '/edu-purchases' },
};
export default async function EduPurchasesPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'edu-purchases');
  return <BlockRenderer layout={layout} />;
}
