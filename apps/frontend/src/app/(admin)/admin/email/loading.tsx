/**
 * Route loading state: a replica of the email templates list, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminEmailSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminEmailSkeleton />;
}
