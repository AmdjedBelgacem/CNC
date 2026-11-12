/**
 * Route loading state: a replica of the staff list, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminStaffSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminStaffSkeleton />;
}
