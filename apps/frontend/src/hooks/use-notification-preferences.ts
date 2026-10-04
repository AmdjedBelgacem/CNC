'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { NotificationPreferences as ApiNotificationPreferences } from '@/lib/api/types';

export const NOTIFICATION_CATEGORIES = ['social', 'learning', 'commerce', 'security'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationPreferenceValues = Record<NotificationCategory, boolean>;
export type NotificationPreferences = ApiNotificationPreferences;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inAppNotifications: {
    social: true,
    learning: true,
    commerce: true,
    security: true,
  },
  emailNotifications: {
    social: false,
    learning: true,
    commerce: true,
    security: true,
  },
};

const legacyKeys: Record<NotificationCategory, string[]> = {
  social: ['social', 'likes', 'comments', 'follows', 'mentions'],
  learning: ['learning', 'courseUpdates', 'recommendations', 'course_updates'],
  commerce: ['commerce', 'promotions', 'orders', 'purchases'],
  security: ['security', 'securityAlerts', 'security_alerts'],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeChannel(
  value: unknown,
  defaults: NotificationPreferenceValues,
): NotificationPreferenceValues {
  const record = asRecord(value) ?? {};
  const result = { ...defaults };
  for (const category of NOTIFICATION_CATEGORIES) {
    const direct = asBoolean(record[category]);
    if (direct !== undefined) {
      result[category] = direct;
      continue;
    }
    const legacyValues = legacyKeys[category]
      .map((key) => asBoolean(record[key]))
      .filter((item): item is boolean => item !== undefined);
    if (legacyValues.length > 0) result[category] = legacyValues.some(Boolean);
  }
  return result;
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const root = asRecord(value);
  const nested = asRecord(root?.data) ?? asRecord(root?.preferences) ?? root ?? {};
  const legacy = asRecord(nested.notifications);
  const inApp = nested.inAppNotifications ?? nested.in_app_notifications ?? legacy;
  const email = nested.emailNotifications ?? nested.email_notifications;
  return {
    inAppNotifications: normalizeChannel(
      inApp,
      DEFAULT_NOTIFICATION_PREFERENCES.inAppNotifications,
    ),
    emailNotifications: normalizeChannel(
      email,
      DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
    ),
  };
}

export function useNotificationPreferences(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => normalizeNotificationPreferences(await api.get<unknown>('/auth/me/preferences')),
    enabled,
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      api.put<unknown>('/auth/me/preferences', {
        inAppNotifications: preferences.inAppNotifications,
        emailNotifications: preferences.emailNotifications,
      }),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(
        ['notification-preferences'],
        normalizeNotificationPreferences(response ?? variables),
      );
    },
  });
  return {
    ...query,
    preferences: query.data,
    savePreferences: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
}
