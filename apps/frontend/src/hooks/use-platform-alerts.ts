'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

/**
 * Unread platform-critical alerts for the admin console.
 *
 * A separate query key from `notificationKeys` on purpose: the two streams are
 * addressed differently (`audience=personal` vs `audience=platform`) and a
 * shared key would let a refetch of one overwrite the other's count.
 */
export const platformAlertKeys = {
  all: ['platform-alerts'] as const,
  overview: () => [...platformAlertKeys.all, 'overview'] as const,
};

export interface PlatformAlertOverview {
  unread: number;
  total: number;
  severity: { critical: number; warning: number; info: number };
  unreadBySeverity: { critical: number; warning: number; info: number };
  byGroup: Record<string, number>;
}

function normalizeUnread(value: unknown): number {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const n = Number(record?.unread);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function usePlatformAlertUnread(enabled = true, pollMs = 30_000) {
  const query = useQuery({
    queryKey: platformAlertKeys.overview(),
    queryFn: async () => normalizeUnread(await api.get<unknown>('/admin/platform-alerts/overview')),
    // A 403 here means the viewer is not a super admin; that is an expected
    // state, not an error worth surfacing or retrying.
    enabled,
    retry: false,
    refetchInterval: pollMs > 0 ? pollMs : false,
    refetchIntervalInBackground: false,
  });
  return { ...query, unreadCount: query.data ?? 0 };
}
