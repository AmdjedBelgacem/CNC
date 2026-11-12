/**
 * Route loading state: a replica of the dashboard (components/admin/dashboard-view.tsx), so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { DashboardSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <DashboardSkeleton />;
}
