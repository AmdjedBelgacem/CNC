/**
 * Route loading state: a replica of the integrations page, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminIntegrationsSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminIntegrationsSkeleton />;
}
