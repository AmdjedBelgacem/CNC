/**
 * Route-level loading state for `/account/security`.
 *
 * A replica of the page (same sections, containers and line heights), so
 * nothing moves when the real content replaces it.
 */
import { AccountSecurityPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <AccountSecurityPageSkeleton />;
}
