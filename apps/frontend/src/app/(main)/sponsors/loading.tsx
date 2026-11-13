/**
 * Route-level loading state for `/sponsors`.
 *
 * A replica of the page: the centred hero, then the remembered sponsors (or the empty box).
 */
import { SponsorsPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <SponsorsPageSkeleton />;
}
