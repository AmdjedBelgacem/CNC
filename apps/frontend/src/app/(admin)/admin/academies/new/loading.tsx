/**
 * Route loading state: a replica of the create-academy card, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { CreateEntitySkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <CreateEntitySkeleton kind="academy" />;
}
