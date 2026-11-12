/**
 * Route loading state: a replica of Course Studio (editor kit: header, rail, form, aside), so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { CourseStudioSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <CourseStudioSkeleton />;
}
