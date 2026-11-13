/**
 * Route-level loading state for `/repair`.
 *
 * A replica of the page: header, category chips and search, the shop list beside the 70vh map.
 */
import { RepairPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <RepairPageSkeleton />;
}
