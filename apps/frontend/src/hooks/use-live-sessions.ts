'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export type LiveSessionJoinState = 'joinable' | 'not_started' | 'ended' | 'not_enrolled' | 'cancelled';

export interface LearnerLiveSession {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  capacity: number | null;
  opensAt: string;
  closesAt: string;
  joinState: LiveSessionJoinState;
  hasMeetUrl: boolean;
}

export interface NextLiveSession {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  opensAt: string;
  closesAt: string;
}

export interface LiveSessionJoinResult {
  meetUrl: string;
  opensAt: string;
  closesAt: string;
}

/**
 * The learner list never carries the Meet URL — the join endpoint is the only
 * source of the link, gated on enrollment + the server-side join window.
 */
export function useCourseLiveSessions(courseId?: string) {
  const query = useQuery({
    queryKey: ['live-sessions', 'course', courseId],
    queryFn: async () =>
      api.get<{ enrolled: boolean; sessions: LearnerLiveSession[] }>(
        `/courses/${encodeURIComponent(courseId!)}/live-sessions`,
      ),
    enabled: !!courseId,
  });
  return { ...query, sessions: query.data?.sessions ?? [], enrolled: query.data?.enrolled ?? false };
}

export function useNextLiveSession(enabled = true) {
  const query = useQuery({
    queryKey: ['live-sessions', 'next'],
    queryFn: () => api.get<NextLiveSession | null>('/live-sessions/next'),
    enabled,
    retry: false,
  });
  return { ...query, nextSession: query.data ?? null };
}

export async function joinLiveSession(sessionId: string): Promise<LiveSessionJoinResult> {
  return api.get<LiveSessionJoinResult>(`/live-sessions/${encodeURIComponent(sessionId)}/join`);
}
