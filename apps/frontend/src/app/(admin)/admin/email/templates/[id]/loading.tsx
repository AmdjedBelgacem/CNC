/**
 * Route loading state: a replica of the email template editor, so nothing moves when the page
 * arrives. The composition lives in components/skeletons/admin-route-skeletons.
 */
import { EmailTemplateEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';

export default function Loading() {
  return <EmailTemplateEditorSkeleton />;
}
