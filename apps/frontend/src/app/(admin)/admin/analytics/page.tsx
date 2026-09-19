import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AnalyticsRoleGate } from './analytics-role-gate';
import { AnalyticsDashboardView } from '@/components/admin/analytics-dashboard';

const ADMIN_ROLES = ['super_admin', 'admin'];

function roleFromAccessTokenPayload(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const json = Buffer.from(payloadPart, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default async function AdminAnalyticsPage() {
  // Server-side hard gate (layer 1): unverified decode is fine for routing — real authorization stays with the API guards and <AdminGate>.
  const store = await cookies();
  const token =
    store.get('access-token')?.value ||
    store.get('__Host-access')?.value ||
    store.get('__Host-access-token')?.value;
  const role = roleFromAccessTokenPayload(token);
  if (role && !ADMIN_ROLES.includes(role)) redirect('/admin');
  const tAdmin = await getTranslations('admin');
  // Client-side hard gate (layer 2): catches stale cookies vs hydrated session.
  return (
    <AnalyticsRoleGate>
      <AnalyticsDashboardView title={tAdmin('analytics')} />
    </AnalyticsRoleGate>
  );
}
