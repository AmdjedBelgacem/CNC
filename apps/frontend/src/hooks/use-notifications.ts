'use client';

import { useCallback, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { safeInternalHref } from '@/lib/safe-href';
import type { Notification } from '@/lib/api/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly = false, limit = 20) =>
    [...notificationKeys.all, 'list', unreadOnly ? 'unread' : 'all', Math.max(1, Math.min(50, limit))] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type NotificationCursor = string | null;
export type NotificationListData = InfiniteData<NotificationPage, NotificationCursor>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

function normalizeNotificationHref(value: unknown): string | null {
  const href = safeInternalHref(value);
  if (!href) return null;
  const url = new URL(href, 'https://internal.invalid');
  if (url.pathname === '/social/feed' || url.pathname.startsWith('/social/feed/')) {
    url.pathname = url.pathname.replace(/^\/social\/feed/, '/feed');
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeNotification(value: unknown): Notification | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asText(record.id ?? record.notificationId);
  const title = asText(record.title ?? record.message);
  const createdAt = asText(record.createdAt ?? record.created_at ?? record.timestamp);
  if (!id || !title || !createdAt) return null;
  const data = asRecord(record.data) ?? null;
  const meta = asRecord(record.meta) ?? null;
  const payload = data || meta ? { ...(meta ?? {}), ...(data ?? {}) } : null;
  const rawHref =
    record.href ??
    record.actionUrl ??
    record.url ??
    record.link ??
    payload?.href ??
    payload?.url ??
    payload?.path ??
    payload?.link;
  const href =
    normalizeNotificationHref(rawHref) ??
    normalizeNotificationHref(payload?.href ?? payload?.url ?? payload?.path ?? payload?.link);
  const type = asText(record.type ?? record.kind) ?? 'system';
  const isRead =
    record.isRead === true ||
    record.isRead === 'true' ||
    record.read === true ||
    record.read === 'true' ||
    record.is_read === true ||
    record.is_read === 'true';
  return {
    id,
    type,
    title,
    body: asText(record.body ?? record.description ?? record.content),
    data: payload,
    meta: meta ?? payload,
    actorId: asText(record.actorId ?? record.actor_id),
    entityType: asText(record.entityType ?? record.entity_type),
    entityId: asText(record.entityId ?? record.entity_id),
    isRead,
    createdAt,
    href,
    actionUrl: normalizeNotificationHref(record.actionUrl),
    category: asText(record.category),
    readAt: asText(record.readAt ?? record.read_at),
  };
}

function normalizeCursor(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function normalizeNotificationPage(
  value: unknown,
  requestedLimit = 20,
  cursor?: string | null,
): NotificationPage {
  const record = asRecord(value);
  const data = asRecord(record?.data);
  const recordIsNotification = !!(record?.id || record?.notificationId);
  const source = Array.isArray(value)
    ? value
    : record?.items ??
      record?.notifications ??
      record?.results ??
      (Array.isArray(record?.data) ? record.data : undefined) ??
      data?.items ??
      data?.notifications ??
      data?.results ??
      (Array.isArray(data?.data) ? data.data : undefined) ??
      (recordIsNotification ? record : data ?? record);
  const sourceRecord = asRecord(source);
  const rawItems = Array.isArray(source)
    ? source
    : sourceRecord?.items ?? sourceRecord?.notifications ?? sourceRecord?.results ??
      (sourceRecord?.id || sourceRecord?.notificationId ? [source] : []);
  const seen = new Set<string>();
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => normalizeNotification(item))
    .filter((item): item is Notification => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  if (Array.isArray(value)) {
    const cursorIndex = cursor ? items.findIndex((item) => item.id === cursor) : -1;
    const start = cursor ? (cursorIndex >= 0 ? cursorIndex + 1 : items.length) : 0;
    const pageItems = items.slice(start, start + requestedLimit);
    const hasMore = start + pageItems.length < items.length;
    return {
      items: pageItems,
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
      hasMore,
    };
  }
  const meta = asRecord(record?.meta);
  const nextValue =
    record?.nextCursor ??
    record?.next_cursor ??
    record?.cursor ??
    record?.next ??
    data?.nextCursor ??
    data?.next_cursor ??
    data?.cursor ??
    data?.next ??
    meta?.nextCursor ??
    meta?.next_cursor ??
    meta?.cursor ??
    meta?.next;
  const nextCursor = normalizeCursor(
    typeof nextValue === 'object' && nextValue !== null
      ? (nextValue as Record<string, unknown>).cursor ?? (nextValue as Record<string, unknown>).nextCursor
      : nextValue,
  );
  const explicitHasMore =
    record?.hasMore ??
    record?.has_more ??
    record?.hasNextPage ??
    data?.hasMore ??
    data?.has_more ??
    meta?.hasMore;
  const hasMore = typeof explicitHasMore === 'boolean' ? explicitHasMore : nextCursor !== null;
  return { items, nextCursor, hasMore: hasMore && nextCursor !== null };
}

export function normalizeUnreadCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const record = asRecord(value);
  if (!record) return 0;
  const candidate = record.count ?? record.unreadCount ?? record.unread_count ?? record.total;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? Math.max(0, candidate) : 0;
}

async function fetchNotificationPage(
  cursor: NotificationCursor,
  limit: number,
  unreadOnly: boolean,
): Promise<NotificationPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (unreadOnly) params.set('unread', 'true');
  const response = await api.get<unknown>(`/notifications?${params.toString()}`);
  return normalizeNotificationPage(response, limit, cursor);
}

function listUpdater(
  updater: (notification: Notification) => Notification,
): (data: NotificationListData | undefined) => NotificationListData | undefined {
  return (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map(updater),
      })),
    };
  };
}

function updateReadState(
  data: NotificationListData | undefined,
  id: string,
  read: boolean,
  removeReadItems: boolean,
): NotificationListData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items
        .filter((item) => !(removeReadItems && item.id === id))
        .map((item) => (item.id === id ? { ...item, isRead: read } : item)),
    })),
  };
}

export function useNotifications(options?: {
  pollMs?: number;
  enabled?: boolean;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const pollMs = options?.pollMs ?? 30_000;
  const enabled = options?.enabled ?? true;
  const limit = Math.max(1, Math.min(50, options?.limit ?? 20));
  const unreadOnly = options?.unreadOnly ?? false;
  const query = useInfiniteQuery<
    NotificationPage,
    Error,
    NotificationListData,
    ReturnType<typeof notificationKeys.list>,
    NotificationCursor
  >({
    queryKey: notificationKeys.list(unreadOnly, limit),
    queryFn: ({ pageParam }) => fetchNotificationPage(pageParam, limit, unreadOnly),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled,
    refetchInterval: pollMs > 0 ? pollMs : false,
    refetchIntervalInBackground: false,
  });
  const notifications = useMemo(() => {
    const seen = new Set<string>();
    const items = (query.data?.pages ?? []).flatMap((page) =>
      page.items.filter((notification) => {
        if (seen.has(notification.id)) return false;
        seen.add(notification.id);
        return true;
      }),
    );
    return items.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      return rightTime - leftTime;
    });
  }, [query.data?.pages]);
  return {
    ...query,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    hasMore: query.hasNextPage,
    isLoadingNextPage: query.isFetchingNextPage,
    loadMore: query.fetchNextPage,
  };
}

export function useUnreadCount(enabled = true, pollMs = 30_000) {
  const query = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => normalizeUnreadCount(await api.get<unknown>('/notifications/unread-count')),
    enabled,
    refetchInterval: pollMs > 0 ? pollMs : false,
    refetchIntervalInBackground: false,
  });
  return { ...query, unreadCount: query.data ?? 0 };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${encodeURIComponent(id)}/read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      const previousLists = queryClient.getQueriesData<NotificationListData>({
        queryKey: notificationKeys.list(),
      });
      const previousUnread = queryClient.getQueryData<number>(notificationKeys.unread());
      let changed = false;
      for (const [queryKey, current] of previousLists) {
        const unreadCache = queryKey[2] === 'unread';
        const hasUnread = current?.pages.some((page) => page.items.some((item) => item.id === id && !item.isRead));
        if (hasUnread) changed = true;
        queryClient.setQueryData<NotificationListData>(queryKey, updateReadState(current, id, true, unreadCache));
      }
      if (changed) {
        queryClient.setQueryData<number>(notificationKeys.unread(), (current) => Math.max(0, (current ?? 0) - 1));
      }
      return { previousLists, previousUnread, changed };
    },
    onError: (_error, _id, context) => {
      for (const [queryKey, data] of context?.previousLists ?? []) queryClient.setQueryData(queryKey, data);
      if (context?.previousUnread !== undefined) queryClient.setQueryData(notificationKeys.unread(), context.previousUnread);
    },
    onSuccess: (_data, id) => {
      const lists = queryClient.getQueriesData<NotificationListData>({ queryKey: notificationKeys.list() });
      for (const [queryKey, current] of lists) {
        queryClient.setQueryData<NotificationListData>(queryKey, updateReadState(current, id, true, queryKey[2] === 'unread'));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unread() });
      const previousLists = queryClient.getQueriesData<NotificationListData>({
        queryKey: notificationKeys.list(),
      });
      const previousUnread = queryClient.getQueryData<number>(notificationKeys.unread());
      for (const [queryKey, current] of previousLists) {
        queryClient.setQueryData<NotificationListData>(queryKey, {
          ...(current ?? { pages: [], pageParams: [] }),
          pages: (current?.pages ?? []).map((page) => ({
            ...page,
            items: queryKey[2] === 'unread' ? [] : page.items.map((notification) => ({ ...notification, isRead: true })),
          })),
        });
      }
      queryClient.setQueryData(notificationKeys.unread(), 0);
      return { previousLists, previousUnread };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(notificationKeys.unread(), context.previousUnread);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unread(), 0);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useRefreshNotifications() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
  }, [queryClient]);
}

export function updateNotificationList(
  data: NotificationListData | undefined,
  notification: Notification,
  unreadOnly = false,
): NotificationListData | undefined {
  if (!data) return data;
  if (unreadOnly && notification.isRead) {
    return {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== notification.id) })),
    };
  }
  const exists = data.pages.some((page) => page.items.some((item) => item.id === notification.id));
  if (exists) {
    return listUpdater((item) => (item.id === notification.id ? { ...item, ...notification } : item))(data);
  }
  const first = data.pages[0];
  if (!first) return data;
  return {
    ...data,
    pages: [
      { ...first, items: [notification, ...first.items] },
      ...data.pages.slice(1),
    ],
  };
}
