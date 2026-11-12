/**
 * Route-level loading state for `/events/[slug]`.
 *
 * A replica of the page's layout (containers, header, grids, sidebars), so
 * nothing moves when the real content replaces it.
 */
import { EventDetailSkeleton } from '@/components/skeletons/public-route-skeletons';

export default function Loading() {
  return <EventDetailSkeleton />;
}
