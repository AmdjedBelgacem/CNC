/**
 * Route-level loading state for `/tags`.
 *
 * A replica of the page (same sections, containers and line heights), so
 * nothing moves when the real content replaces it.
 */
import { TagIndexPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <TagIndexPageSkeleton />;
}
