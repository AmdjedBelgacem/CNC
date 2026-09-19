import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
export const metadata: Metadata = {
  title: 'About Us | TITANS of Manufacturing',
  description:
    'From a single CNC shop to a global education movement — TITANS of Manufacturing is on a mission to save manufacturing education.',
  alternates: { canonical: '/about' },
};
export default async function AboutPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'about');
  return <BlockRenderer layout={layout} />;
}
