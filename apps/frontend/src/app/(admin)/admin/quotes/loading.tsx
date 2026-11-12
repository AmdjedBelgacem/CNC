/**
 * Route loading state: a replica of the quotes inbox, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminQuotesSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminQuotesSkeleton />;
}
