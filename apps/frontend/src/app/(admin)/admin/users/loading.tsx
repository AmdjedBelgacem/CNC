/**
 * Route loading state: a replica of the learners list, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminUsersSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminUsersSkeleton />;
}
