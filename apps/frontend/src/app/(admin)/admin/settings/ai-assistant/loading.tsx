/**
 * Route loading state: a replica of the AI assistant settings, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { AiAssistantSettingsSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <AiAssistantSettingsSkeleton />;
}
