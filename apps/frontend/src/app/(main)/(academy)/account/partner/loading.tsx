/**
 * Route-level loading state for `/account/partner`.
 *
 * Without it the route inherited the `/account` dashboard skeleton. A replica of the heading
 * and the remembered applications (the dashed empty box at zero).
 */
import { AccountPartnerPageSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <AccountPartnerPageSkeleton />;
}
