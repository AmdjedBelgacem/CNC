import { getTranslations } from 'next-intl/server';
import { AnalyticsRoleGate } from './analytics-role-gate';
import { AnalyticsDashboardView } from '@/components/admin/analytics-dashboard';

export default async function AdminAnalyticsPage() {
  /*
   * Access control is enforced by the client gate and the API guards.
   *
   * This page used to decode `role` out of the access-token cookie before rendering. The cookie is
   * a Supabase JWT, where `role` is the fixed value `authenticated`, not the tenant role. The
   * server therefore redirected every admin — including super admins — to /admin, while the
   * dashboard itself looked fine. There is no trustworthy app-role claim in that token to check
   * here, so routing must defer to the hydrated session and the backend guards.
   */
  const tAdmin = await getTranslations('admin');
  return (
    <AnalyticsRoleGate>
      <AnalyticsDashboardView title={tAdmin('analytics')} />
    </AnalyticsRoleGate>
  );
}
