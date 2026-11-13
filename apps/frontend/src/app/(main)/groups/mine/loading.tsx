/**
 * Route-level loading state for `/groups/mine`.
 *
 * Without it the route inherited `/groups/loading.tsx` (hero, map and card grid), which is
 * nearly twice as tall as this page. A replica of the header and the remembered groups.
 */
import { MyGroupsPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <MyGroupsPageSkeleton />;
}
