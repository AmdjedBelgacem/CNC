/**
 * Route loading state: a replica of the theme editor, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { ThemeEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <ThemeEditorSkeleton />;
}
