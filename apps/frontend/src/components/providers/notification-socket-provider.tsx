'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { skipSocket, socketOptions } from '@/lib/realtime';
import {
  normalizeNotification,
  notificationKeys,
  updateNotificationList,
  type NotificationListData,
} from '@/hooks/use-notifications';

interface NotificationSocketContextValue {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
  /**
   * True when realtime is unavailable and the REST poller is the only source of truth.
   * Consumers should say "polling" rather than "reconnecting" — the socket is not coming
   * back, so a reconnecting label would be a lie that never resolves.
   */
  pollingOnly: boolean;
}

const NotificationSocketContext = createContext<NotificationSocketContextValue>({
  socket: null,
  connected: false,
  reconnecting: false,
  pollingOnly: false,
});

function websocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL?.trim();
  // No configured host: go same-origin in production. `/socket.io/*` is rewritten to the
  // backend service, so the socket needs no public API hostname and automatically follows
  // whichever domain is deployed.
  //
  // This used to fall back to a hardcoded 'http://localhost:4000', which in the browser
  // meant every production client dialled its own machine. It could never connect — it just
  // burned three retries (and logged a CSP violation each time, since the policy allows
  // `wss:` but not `ws://localhost`) before quietly falling back to REST polling. Reading as
  // a real bug only once realtime left `polling` mode, where no socket is attempted at all.
  const base = (configured ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000'))
    .replace(/\/+$/, '')
    .replace(/\/ws$/, '');
  // `/ws` is the Socket.IO *namespace* (see WsGateway), not the HTTP path — the transport
  // still upgrades on the default /socket.io path.
  return `${base}/ws`;
}

function countFromPayload(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const count = record.count ?? record.unreadCount ?? record.unread_count ?? record.total;
  if (typeof count === 'number' && Number.isFinite(count)) return Math.max(0, count);
  if (typeof count === 'object') return countFromPayload(count);
  return record.data !== undefined ? countFromPayload(record.data) : null;
}

function notificationFromPayload(value: unknown): unknown {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!record) return value;
  if (record.notification !== undefined) return notificationFromPayload(record.notification);
  if (!record.id && !record.notificationId && record.data !== undefined) {
    return notificationFromPayload(record.data);
  }
  return record;
}

function hasNotification(data: NotificationListData | undefined, id: string): boolean {
  return !!data?.pages.some((page) => page.items.some((item) => item.id === id));
}

function cachedNotification(data: NotificationListData | undefined, id: string) {
  for (const page of data?.pages ?? []) {
    const item = page.items.find((notification) => notification.id === id);
    if (item) return item;
  }
  return undefined;
}

export function NotificationSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [pollingOnly, setPollingOnly] = useState(skipSocket());

  useEffect(() => {
    if (!hydrated || !isAuthenticated) {
      queryClient.removeQueries({ queryKey: notificationKeys.all });
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
      return;
    }

    // Realtime explicitly disabled (NEXT_PUBLIC_REALTIME_MODE=polling). The REST poller in
    // use-notifications.ts keeps the unread badge and list fresh, so there is nothing to
    // do here — and no socket to reconnect to.
    if (skipSocket()) {
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
      setPollingOnly(true);
      return;
    }

    const nextSocket = io(websocketUrl(), {
      ...socketOptions(),
      autoConnect: true,
      query: { tenant: process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || DEFAULT_TENANT_SLUG },
    });
    socketRef.current = nextSocket;
    setSocket(nextSocket);

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setPollingOnly(false);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    };
    const onDisconnect = () => {
      setConnected(false);
      setReconnecting(true);
    };
    const onConnectError = () => {
      setConnected(false);
      setReconnecting(true);
    };
    // Socket.IO gives up after `reconnectionAttempts`. When it does, realtime is not
    // coming back on this host — switch the UI to the polling label so the bell stops
    // promising a connection that will never arrive.
    const onGiveUp = () => {
      setConnected(false);
      setReconnecting(false);
      setPollingOnly(true);
    };
    const onUnreadCount = (payload: unknown) => {
      const count = countFromPayload(payload);
      if (count !== null) queryClient.setQueryData(notificationKeys.unread(), count);
    };
    const onNotification = (payload: unknown) => {
      const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const notification = normalizeNotification(notificationFromPayload(payload));
      if (!notification) {
        onUnreadCount(payload);
        void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
        return;
      }
      const lists = queryClient.getQueriesData<NotificationListData>({
        queryKey: notificationKeys.list(),
      });
      const current = lists.map(([, data]) => data).find((data) => !!data);
      const previous = cachedNotification(current, notification.id);
      const alreadyPresent = lists.some(([, data]) => hasNotification(data, notification.id));
      for (const [queryKey, data] of lists) {
        queryClient.setQueryData<NotificationListData>(
          queryKey,
          updateNotificationList(data, notification, queryKey[2] === 'unread'),
        );
      }
      const explicitCount = countFromPayload(record);
      if (explicitCount !== null) {
        queryClient.setQueryData(notificationKeys.unread(), explicitCount);
      } else if (!notification.isRead && (!alreadyPresent || previous?.isRead)) {
        queryClient.setQueryData<number>(notificationKeys.unread(), (count) => (count ?? 0) + 1);
      }
      if (!current) {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      }
    };

    nextSocket.on('connect', onConnect);
    nextSocket.on('disconnect', onDisconnect);
    nextSocket.on('connect_error', onConnectError);
    nextSocket.io.on('reconnect_failed', onGiveUp);
    nextSocket.on('notification:new', onNotification);
    nextSocket.on('notification:unread-count', onUnreadCount);
    nextSocket.on('notifications:unread-count', onUnreadCount);
    nextSocket.on('notification:unread', onUnreadCount);
    nextSocket.on('notifications:unread', onUnreadCount);
    nextSocket.on('notification:count', onUnreadCount);
    nextSocket.on('unread-count', onUnreadCount);

    return () => {
      nextSocket.off('connect', onConnect);
      nextSocket.off('disconnect', onDisconnect);
      nextSocket.off('connect_error', onConnectError);
      nextSocket.io.off('reconnect_failed', onGiveUp);
      nextSocket.off('notification:new', onNotification);
      nextSocket.off('notification:unread-count', onUnreadCount);
      nextSocket.off('notifications:unread-count', onUnreadCount);
      nextSocket.off('notification:unread', onUnreadCount);
      nextSocket.off('notifications:unread', onUnreadCount);
      nextSocket.off('notification:count', onUnreadCount);
      nextSocket.off('unread-count', onUnreadCount);
      nextSocket.disconnect();
      if (socketRef.current === nextSocket) socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
    };
  }, [hydrated, isAuthenticated, queryClient]);

  return (
    <NotificationSocketContext.Provider value={{ socket, connected, reconnecting, pollingOnly }}>
      {children}
    </NotificationSocketContext.Provider>
  );
}

export function useNotificationSocket(): NotificationSocketContextValue {
  return useContext(NotificationSocketContext);
}
