/**
 * Route-level loading state for `/academy/[slug]`.
 *
 * A replica of the page's layout (containers, header, grids, sidebars), so
 * nothing moves when the real content replaces it.
 */
import { AcademyDetailSkeleton } from '@/components/skeletons/public-route-skeletons';

export default function Loading() {
  return <AcademyDetailSkeleton />;
}
