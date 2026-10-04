import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { IntegrationsPanel } from './integrations-panel';
import { SkeletonCard } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Google Integrations | TITANS of Manufacturing',
  description: 'Connect Google Ads, Merchant Center, Tag Manager and Search Console.',
};

export default function AdminIntegrationsPage() {
  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        title="Google integrations"
        description="Platform-level connections. Super admin only."
      />
      {/* Was `fallback={null}`: the panel is the entire page body, so a null
          fallback left the user looking at a header above an empty void. */}
      <Suspense fallback={<IntegrationsSkeleton />}>
        <IntegrationsPanel />
      </Suspense>
    </div>
  );
}

/** One placeholder card per integration surface the panel can render. */
function IntegrationsSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading integrations"
    >
      <span className="sr-only">Loading integrations</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} media={false} lines={3} />
      ))}
    </div>
  );
}
