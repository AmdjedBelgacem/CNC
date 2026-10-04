import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Realtime mode selection.
 *
 * On a host that cannot hold connections (Vercel Functions), the socket must stop
 * retrying and let REST polling take over. Notifications already poll; chat cannot and
 * must say so instead of failing silently.
 */
describe('realtime mode', () => {
  const load = (env: Record<string, string | undefined>) => {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return import('../src/lib/realtime');
  };

  it('defaults to auto when unset', async () => {
    const { realtimeMode, skipSocket } = await load({ NEXT_PUBLIC_REALTIME_MODE: undefined });
    expect(realtimeMode()).toBe('auto');
    // auto still opens the socket initially; it just gives up after repeated failures.
    expect(skipSocket()).toBe(false);
  });

  it('honours polling mode', async () => {
    const { realtimeMode, skipSocket } = await load({ NEXT_PUBLIC_REALTIME_MODE: 'polling' });
    expect(realtimeMode()).toBe('polling');
    expect(skipSocket()).toBe(true);
  });

  it('is case and whitespace insensitive', async () => {
    const { realtimeMode } = await load({ NEXT_PUBLIC_REALTIME_MODE: '  Polling ' });
    expect(realtimeMode()).toBe('polling');
  });

  it('falls back to auto for an unrecognised value instead of throwing', async () => {
    const { realtimeMode, skipSocket } = await load({ NEXT_PUBLIC_REALTIME_MODE: 'websocket-ish' });
    expect(realtimeMode()).toBe('auto');
    expect(skipSocket()).toBe(false);
  });

  it('treats socket mode as pinned: never gives up', async () => {
    const { socketOptions, skipSocket } = await load({ NEXT_PUBLIC_REALTIME_MODE: 'socket' });
    expect(skipSocket()).toBe(false);
    expect(socketOptions().reconnectionAttempts).toBe(Infinity);
  });

  it('caps reconnection attempts in auto mode so retries cannot loop forever', async () => {
    const { socketOptions } = await load({ NEXT_PUBLIC_REALTIME_MODE: undefined });
    const opts = socketOptions();
    expect(opts.reconnectionAttempts).toBe(3);
    expect(opts.withCredentials).toBe(true);
    expect(opts.transports).toContain('websocket');
  });

  it('carries credentials and a connect timeout on every transport', async () => {
    const { socketOptions } = await load({ NEXT_PUBLIC_REALTIME_MODE: 'auto' });
    const opts = socketOptions();
    expect(opts.withCredentials).toBe(true);
    expect(opts.timeout).toBeGreaterThan(0);
  });
});

describe('surfaces degrade consistently', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

  it('the notification provider does not open a socket in polling mode', () => {
    const src = read('src/components/providers/notification-socket-provider.tsx');
    expect(src).toMatch(/if \(skipSocket\(\)\)/);
  });

  it('the provider reports pollingOnly once the socket gives up', () => {
    const src = read('src/components/providers/notification-socket-provider.tsx');
    expect(src).toMatch(/reconnect_failed/);
    expect(src).toMatch(/pollingOnly/);
  });

  it('the bell shows the polling label rather than promising a reconnect', () => {
    const src = read('src/components/notifications/notification-bell.tsx');
    expect(src).toMatch(/pollingOnly\s*\?\s*t\('polling'\)/);
  });

  it('both surfaces share one socket configuration instead of hardcoding transports', () => {
    for (const rel of [
      'src/components/providers/notification-socket-provider.tsx',
      'src/components/chat/chat-widget.tsx',
    ]) {
      const src = read(rel);
      expect(src).toContain('socketOptions()');
      // Hardcoding the transport list per component is how the two drift apart.
      expect(src).not.toMatch(/transports:\s*\['websocket',\s*'polling'\]/);
    }
  });

  it('chat surfaces an unavailable state instead of a silently dead composer', () => {
    const src = read('src/components/chat/chat-widget.tsx');
    expect(src).toMatch(/unavailable/);
    expect(src).toMatch(/Live chat is unavailable/);
    // The composer must be hidden, otherwise messages vanish with no explanation.
    expect(src).toMatch(/\{!unavailable && \(/);
  });
});