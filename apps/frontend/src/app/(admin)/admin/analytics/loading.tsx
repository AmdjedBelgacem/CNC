/**
 * Route loading state: a replica of the analytics dashboard, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AdminAnalyticsSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AdminAnalyticsSkeleton />;
}
