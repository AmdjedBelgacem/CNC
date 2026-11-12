/**
 * Route loading state: a replica of the certificates page (issued tab), so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminCertificatesSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminCertificatesSkeleton />;
}
