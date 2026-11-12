/**
 * Route loading state: a replica of the finance page, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminFinanceSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminFinanceSkeleton />;
}
