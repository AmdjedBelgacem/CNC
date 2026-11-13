/**
 * Route-level loading state for `/terms`.
 *
 * A replica of the page (same sections, containers and line heights), so
 * nothing moves when the real content replaces it.
 */
import { TermsPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <TermsPageSkeleton />;
}
