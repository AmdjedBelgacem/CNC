/**
 * Route loading state: a replica of the partner applications page, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminPartnersSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminPartnersSkeleton />;
}
