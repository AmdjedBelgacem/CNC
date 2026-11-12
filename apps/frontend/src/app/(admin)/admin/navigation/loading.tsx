/**
 * Route loading state: a replica of the navigation editor, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { NavigationEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <NavigationEditorSkeleton />;
}
