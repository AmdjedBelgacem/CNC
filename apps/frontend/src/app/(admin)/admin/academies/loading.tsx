/**
 * Route loading state: a replica of the academies list, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminAcademiesSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminAcademiesSkeleton />;
}
