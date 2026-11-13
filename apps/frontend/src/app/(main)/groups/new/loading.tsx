/**
 * Route-level loading state for `/groups/new`.
 *
 * Without it the route inherited `/groups/loading.tsx`. A replica of `GroupFormShell` around
 * `GroupForm`, field for field.
 */
import { NewGroupPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <NewGroupPageSkeleton />;
}
