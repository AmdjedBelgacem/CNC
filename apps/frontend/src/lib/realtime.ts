/**
 * Realtime transport selection.
 *
 * The app has two realtime surfaces, and they degrade differently:
 *
 *  - **Notifications** already poll over REST (`useNotifications` / `useUnreadCount` set
 *    `refetchInterval`), so they keep working with no socket at all. Only the retry
 *    churn and the misleading "reconnecting" label were a problem.
 *  - **Chat** (`chat-widget.tsx`) is entirely socket-driven — `chat:start`,
 *    `chat:history` and `chat:message` have no REST equivalent in the backend, so
 *    polling cannot replace the socket. It degrades to "unavailable", not "slow".
 *
 * `auto` (default) keeps the socket and stops retrying after repeated failures, so the
 * existing REST polling takes over quietly. `polling` skips the socket from the start,
 * which is what you want on a host that cannot hold connections (Vercel Functions).
 * `socket` pins the socket and disables the graceful stop — useful in local dev.
 *
 * Set via `NEXT_PUBLIC_REALTIME_MODE`. Note this is a `NEXT_PUBLIC_*` variable, so it
 * is inlined at build time: changing it requires a rebuild, not just a restart.
 */

export type RealtimeMode = 'auto' | 'socket' | 'polling';

export const REALTIME_MODE_ENV = 'NEXT_PUBLIC_REALTIME_MODE';

const VALID: readonly RealtimeMode[] = ['auto', 'socket', 'polling'];

/** Reads the configured mode, falling back to `auto` for anything unrecognised. */
export function realtimeMode(): RealtimeMode {
  const raw = process.env[REALTIME_MODE_ENV]?.trim().toLowerCase();
  return VALID.includes(raw as RealtimeMode) ? (raw as RealtimeMode) : 'auto';
}

/** True when the socket should not be opened at all. */
export function skipSocket(): boolean {
  return realtimeMode() === 'polling';
}

/**
 * Consecutive connection failures before giving up on the socket and letting REST
 * polling take over. Socket.IO retries forever by default, which on a host that cannot
 * hold connections means an endless reconnect loop against a dead endpoint.
 */
export const SOCKET_GIVE_UP_AFTER = 3;

/** Socket.IO options shared by both realtime surfaces. */
export function socketOptions(): {
  transports: ('websocket' | 'polling')[];
  withCredentials: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
} {
  const giveUp = realtimeMode() === 'socket' ? Infinity : SOCKET_GIVE_UP_AFTER;
  return {
    // 'polling' here is Socket.IO's HTTP long-polling transport, which still needs a
    // live server. It is kept as a fallback for restrictive dev networks, not as a
    // substitute for the REST polling in use-notifications.ts.
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnectionAttempts: giveUp,
    reconnectionDelay: 1000,
    timeout: 8000,
  };
}