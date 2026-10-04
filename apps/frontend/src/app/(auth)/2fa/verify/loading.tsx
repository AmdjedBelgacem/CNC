/**
 * Route-level loading state for `/(auth)/2fa/verify`.
 *
 * Next.js shows this the instant navigation starts and keeps it on screen until
 * the segment's server render resolves. Without it the browser paints nothing —
 * which on a slow connection reads as a blank page, not as "loading".
 *
 * The composition mirrors the real layout so nothing reflows on arrival.
 */
import { AuthSkeleton } from '@/components/skeletons/route-skeletons';
export default function Loading() {
  return <AuthSkeleton fields={1} />;
}
