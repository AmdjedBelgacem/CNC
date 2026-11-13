/**
 * Route loading state: a replica of the dashboard (components/admin/dashboard-view.tsx), so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 *
 * It sits in the `(dashboard)` group so it wraps the dashboard alone. At `admin/loading.tsx` it
 * was the boundary for every admin page, and any navigation that had not prefetched its target
 * (search, the bottom bar, the collapsed sidebar) showed the dashboard's skeleton on top of the
 * wrong page instead of that page's own replica.
 */
import { DashboardSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <DashboardSkeleton />;
}
