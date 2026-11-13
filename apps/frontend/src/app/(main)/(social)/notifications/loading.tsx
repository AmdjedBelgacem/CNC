/**
 * Route-level loading state for `/notifications`.
 *
 * A replica of the inbox (header, tabs, the rows grouped by day as the page last showed them),
 * so the page keeps its height when the notifications arrive.
 */
import { NotificationsPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <NotificationsPageSkeleton />;
}
