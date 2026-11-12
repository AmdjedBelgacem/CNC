/**
 * Route loading state: a replica of the workspace settings form, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminSettingsSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminSettingsSkeleton />;
}
