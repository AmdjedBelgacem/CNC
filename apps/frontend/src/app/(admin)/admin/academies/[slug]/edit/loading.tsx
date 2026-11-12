/**
 * Route loading state: a replica of the academy editor (editor kit: header, rail, form, aside), so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AcademyEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AcademyEditorSkeleton />;
}
