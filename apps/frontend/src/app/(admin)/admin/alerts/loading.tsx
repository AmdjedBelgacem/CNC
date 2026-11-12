/**
 * Route loading state: a replica of the platform alerts page, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminAlertsSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminAlertsSkeleton />;
}
