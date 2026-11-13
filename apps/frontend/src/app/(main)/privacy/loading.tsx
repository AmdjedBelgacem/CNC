/**
 * Route-level loading state for `/privacy`.
 *
 * A replica of the page (same sections, containers and line heights), so
 * nothing moves when the real content replaces it.
 */
import { PrivacyPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <PrivacyPageSkeleton />;
}
