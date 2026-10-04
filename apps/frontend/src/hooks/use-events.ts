'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useBuyAndCheckout } from '@/hooks/use-payments';
import { toList } from '@/lib/api/normalize';
import type { AppEvent } from '@/lib/api/types';

export const eventKeys = {
  all: ['events'] as const,
  list: (params?: string) => [...eventKeys.all, 'list', params ?? ''] as const,
  upcoming: (limit: number) => [...eventKeys.all, 'upcoming', limit] as const,
  detail: (slug: string) => [...eventKeys.all, 'detail', slug] as const,
};

export function useEvents(params?: { upcoming?: boolean; type?: string }) {
  const qs = new URLSearchParams();
  if (params?.upcoming) qs.set('upcoming', 'true');
  if (params?.type) qs.set('type', params.type);
  const search = qs.toString();
  const query = useQuery({
    queryKey: eventKeys.list(search),
    queryFn: async () => toList<AppEvent>(await api.get(`/events${search ? `?${search}` : ''}`)),
  });
  return { ...query, events: query.data ?? [] };
}

export function useUpcomingEvents(limit = 3) {
  const query = useQuery({
    queryKey: eventKeys.upcoming(limit),
    queryFn: async () => toList<AppEvent>(await api.get(`/events/upcoming?limit=${limit}`)),
  });
  return { ...query, events: query.data ?? [] };
}

export function useEvent(slug: string) {
  const query = useQuery({
    queryKey: eventKeys.detail(slug),
    queryFn: () => api.get<AppEvent>(`/events/${slug}`),
    enabled: !!slug,
  });
  return { ...query, event: query.data ?? null };
}

/**
 * A free event registers directly. A paid one must go through the gateway like
 * any other purchase, so the ticket is only issued once payment is verified.
 */
export function useToggleEventRegistration() {
  const qc = useQueryClient();
  const { buy, pending: buying } = useBuyAndCheckout();
  return {
    ...useMutation({
      mutationFn: async ({
        eventId,
        registered,
      }: {
        eventId: string;
        registered: boolean;
        priceCents?: number;
      }) => {
        if (registered) return api.delete(`/events/${eventId}/register`);
        return api.post(`/events/${eventId}/register`);
      },
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: eventKeys.all });
      },
    }),
    buy,
    buying,
  };
}
