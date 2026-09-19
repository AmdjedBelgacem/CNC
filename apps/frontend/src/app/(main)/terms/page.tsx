import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'Terms of Service | TITANS of Manufacturing',
  description:
    'Review the terms and conditions governing your use of the TITANS of Manufacturing platform.',
  alternates: { canonical: '/terms' },
};
export default async function TermsPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'terms');
  return <BlockRenderer layout={layout} />;
}
