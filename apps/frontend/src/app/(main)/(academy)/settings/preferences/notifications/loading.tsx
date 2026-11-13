/**
 * Route-level loading state for `/settings/preferences/notifications`.
 *
 * Rendered inside the settings shell. A replica of the page body (header, two channels of four
 * switches, save bar), which is taller than the generic settings form skeleton.
 */
import { NotificationPreferencesSkeleton } from '@/components/skeletons/public-page-replicas';

export default function Loading() {
  return <NotificationPreferencesSkeleton />;
}
