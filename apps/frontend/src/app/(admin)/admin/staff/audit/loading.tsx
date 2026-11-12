/**
 * Route loading state: a replica of the audit log, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminAuditSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminAuditSkeleton />;
}
