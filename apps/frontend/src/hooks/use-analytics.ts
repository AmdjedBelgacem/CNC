'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toList } from '@/lib/api/normalize';
import type {
  AnalyticsActivityItem,
  AnalyticsBreakdowns,
  AnalyticsInsights,
  AnalyticsOverview,
  AnalyticsSeries,
  AnalyticsTrends,
  TopCourse,
} from '@/lib/api/types';

export type AnalyticsRange = '7d' | '30d' | '90d' | '12m';

export const analyticsKeys = {
  all: ['analytics'] as const,
  scoped: (range: AnalyticsRange) => [...analyticsKeys.all, range] as const,
  endpoint: (name: string, range: AnalyticsRange) =>
    [...analyticsKeys.all, name, range] as const,
};

function useAnalyticsQuery<T>(name: string, range: AnalyticsRange, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.endpoint(name, range),
    queryFn: () => api.get<T>(`/admin/analytics/${name}?range=${range}`),
    enabled,
    retry: 0,
  });
}

/** Admin-only. `enabled` should be gated on the caller's role. */
export function useAnalyticsOverview(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsOverview>('overview', range, enabled);
}
export function useAnalyticsEnrollments(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsSeries>('enrollments', range, enabled);
}
export function useAnalyticsRevenue(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsSeries>('revenue', range, enabled);
}
export function useAnalyticsTrends(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsTrends>('trends', range, enabled);
}
export function useAnalyticsBreakdowns(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsBreakdowns>('breakdowns', range, enabled);
}
export function useAnalyticsInsights(range: AnalyticsRange, enabled = true) {
  return useAnalyticsQuery<AnalyticsInsights>('insights', range, enabled);
}

export function useAnalyticsTopCourses(range: AnalyticsRange, limit = 8, enabled = true) {
  const query = useQuery({
    queryKey: analyticsKeys.endpoint(`top-courses-${limit}`, range),
    queryFn: async () =>
      toList<TopCourse>(await api.get(`/admin/analytics/top-courses?range=${range}&limit=${limit}`)),
    enabled,
    retry: 0,
  });
  return { ...query, courses: query.data ?? [] };
}

export function useAnalyticsActivity(range: AnalyticsRange, limit = 15, enabled = true) {
  const query = useQuery({
    queryKey: analyticsKeys.endpoint(`activity-${limit}`, range),
    queryFn: async () =>
      toList<AnalyticsActivityItem>(
        await api.get(`/admin/analytics/activity?range=${range}&limit=${limit}`),
      ),
    enabled,
    retry: 0,
  });
  return { ...query, activity: query.data ?? [] };
}
