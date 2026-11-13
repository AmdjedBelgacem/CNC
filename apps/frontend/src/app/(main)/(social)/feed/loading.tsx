/**
 * Route-level loading state for `/feed`.
 *
 * A replica of the page (same sections, containers and line heights), so
 * nothing moves when the real content replaces it.
 */
import { FeedPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <FeedPageSkeleton />;
}
