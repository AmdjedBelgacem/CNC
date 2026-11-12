/**
 * Route-level loading state for `/courses/[slug]/lessons/[lessonSlug]`.
 *
 * A replica of the page's layout (containers, header, grids, sidebars), so
 * nothing moves when the real content replaces it.
 */
import { LessonPageSkeleton } from '@/components/skeletons/public-route-skeletons';

export default function Loading() {
  return <LessonPageSkeleton />;
}
