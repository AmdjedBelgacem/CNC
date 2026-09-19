import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisThrottlerStorage } from '../src/modules/auth/providers/redis-throttler-storage';

/**
 * Contract test for @nestjs/throttler v6.
 *
 * Source of truth: node_modules/@nestjs/throttler/dist/throttler.guard.js
 *   const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
 *     await this.storageService.increment(key, ttl, limit, blockDuration, throttler.name);
 *   if (isBlocked) { res.header('Retry-After', timeToBlockExpire); throw ThrottlerException }
 *   res.header('X-RateLimit-Remaining', Math.max(0, limit - totalHits));
 *   res.header('X-RateLimit-Reset', timeToExpire);
 *
 * Two unit bugs this suite pins down, both of which silently disabled throttling:
 *   1. `isBlocked` was hardcoded to `false`, so the guard never threw → no 429, ever.
 *   2. `ttl` (already milliseconds) was passed to `pexpire` as `ttl * 1000`, making
 *      every window 1000x too long (60s became 16.7 hours; 1h became 41.6 days).
 */

/** Minimal in-memory Redis stand-in: only the commands the storage uses. */
class FakeRedis {
  store = new Map<string, string>();
  expiries = new Map<string, number>(); // absolute epoch ms
  calls: { cmd: string; args: unknown[] }[] = [];

  private live(key: string) {
    const exp = this.expiries.get(key);
    if (exp !== undefined && exp <= Date.now()) {
      this.store.delete(key);
      this.expiries.delete(key);
      return false;
    }
    return this.store.has(key);
  }

  async get(key: string) {
    this.calls.push({ cmd: 'get', args: [key] });
    return this.live(key) ? (this.store.get(key) ?? null) : null;
  }
  async incr(key: string) {
    this.calls.push({ cmd: 'incr', args: [key] });
    const next = (this.live(key) ? parseInt(this.store.get(key)!, 10) : 0) + 1;
    this.store.set(key, String(next));
    return next;
  }
  async pttl(key: string) {
    this.calls.push({ cmd: 'pttl', args: [key] });
    const exp = this.expiries.get(key);
    if (exp === undefined || !this.store.has(key)) return -2;
    return Math.max(0, exp - Date.now());
  }
  async pexpire(key: string, ms: number) {
    this.calls.push({ cmd: 'pexpire', args: [key, ms] });
    if (!this.store.has(key)) return 0;
    this.expiries.set(key, Date.now() + ms);
    return 1;
  }
  async psetex(key: string, ms: number, value: string) {
    this.calls.push({ cmd: 'psetex', args: [key, ms, value] });
    this.store.set(key, value);
    this.expiries.set(key, Date.now() + ms);
    return 'OK';
  }
  async del(...keys: string[]) {
    this.calls.push({ cmd: 'del', args: keys });
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
      this.expiries.delete(k);
    }
    return n;
  }
  on() {}
  async quit() {}
}

function makeStorage() {
  const config = { get: vi.fn().mockReturnValue('redis://localhost:6379') } as any;
  const storage = new RedisThrottlerStorage(config);
  const redis = new FakeRedis();
  (storage as any).redis = redis;
  return { storage, redis };
}

const RECORD_KEYS = ['totalHits', 'timeToExpire', 'isBlocked', 'timeToBlockExpire'].sort();

describe('RedisThrottlerStorage — @nestjs/throttler v6 contract', () => {
  let storage: RedisThrottlerStorage;
  let redis: FakeRedis;

  beforeEach(() => {
    ({ storage, redis } = makeStorage());
  });

  it('returns exactly the v6 ThrottlerStorageRecord shape', async () => {
    const rec = await storage.increment('k', 60_000, 10, 0, 'default');
    expect(Object.keys(rec).sort()).toEqual(RECORD_KEYS);
    expect(typeof rec.totalHits).toBe('number');
    expect(typeof rec.timeToExpire).toBe('number');
    expect(typeof rec.isBlocked).toBe('boolean');
    expect(typeof rec.timeToBlockExpire).toBe('number');
  });

  it('isBlocked stays false at and below the limit', async () => {
    for (let i = 1; i <= 10; i++) {
      const rec = await storage.increment('k', 60_000, 10, 0, 'default');
      expect(rec.totalHits).toBe(i);
      expect(rec.isBlocked).toBe(false);
    }
  });

  it('isBlocked becomes true once the limit is exceeded (the guard then 429s)', async () => {
    for (let i = 1; i <= 10; i++) await storage.increment('k', 60_000, 10, 0, 'default');
    const rec = await storage.increment('k', 60_000, 10, 0, 'default');
    expect(rec.totalHits).toBe(11);
    expect(rec.isBlocked).toBe(true);
    expect(rec.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('treats ttl as MILLISECONDS — never multiplies by 1000', async () => {
    await storage.increment('k', 60_000, 10, 0, 'default');
    const pexpire = redis.calls.find((c) => c.cmd === 'pexpire');
    expect(pexpire).toBeDefined();
    expect(pexpire!.args[1]).toBe(60_000); // NOT 60_000_000
  });

  it('reports timeToExpire in SECONDS', async () => {
    const rec = await storage.increment('k', 60_000, 10, 0, 'default');
    expect(rec.timeToExpire).toBe(60); // 60_000ms -> 60s, not 60_000
  });

  it('reports timeToBlockExpire in SECONDS and honours blockDuration', async () => {
    for (let i = 1; i <= 3; i++) await storage.increment('k', 60_000, 3, 0, 'default');
    const rec = await storage.increment('k', 60_000, 3, 120_000, 'default');
    expect(rec.isBlocked).toBe(true);
    expect(rec.timeToBlockExpire).toBeGreaterThan(0);
    expect(rec.timeToBlockExpire).toBeLessThanOrEqual(120);
  });

  it('keeps reporting isBlocked while the block window is live, without re-incrementing', async () => {
    for (let i = 1; i <= 3; i++) await storage.increment('k', 60_000, 3, 60_000, 'default');
    const blocked = await storage.increment('k', 60_000, 3, 60_000, 'default');
    expect(blocked.isBlocked).toBe(true);
    const again = await storage.increment('k', 60_000, 3, 60_000, 'default');
    expect(again.isBlocked).toBe(true);
    expect(again.totalHits).toBe(blocked.totalHits); // not incremented again
  });

  it('isolates counters per key', async () => {
    await storage.increment('a', 60_000, 1, 0, 'default');
    const other = await storage.increment('b', 60_000, 1, 0, 'default');
    expect(other.totalHits).toBe(1);
    expect(other.isBlocked).toBe(false);
  });

  it('fail-OPEN when Redis is unavailable, so a cache outage never 500s the API', async () => {
    (storage as any).redis = {
      pttl: () => Promise.reject(new Error('ECONNREFUSED')),
      on: () => {},
    };
    const rec = await storage.increment('k', 60_000, 10, 0, 'default');
    expect(rec.isBlocked).toBe(false);
    expect(rec.totalHits).toBe(0);
  });

  it('reset clears both the counter and the block marker', async () => {
    for (let i = 1; i <= 2; i++) await storage.increment('k', 60_000, 1, 60_000, 'default');
    expect((await storage.increment('k', 60_000, 1, 60_000, 'default')).isBlocked).toBe(true);
    await storage.reset('k');
    const fresh = await storage.increment('k', 60_000, 1, 60_000, 'default');
    expect(fresh.totalHits).toBe(1);
    expect(fresh.isBlocked).toBe(false);
  });

  /**
   * A counter must never outlive its own window.
   *
   * Observed live: `GET /academies` sat at 429 indefinitely. The counter key held
   * 168 (limit 100) with a PTTL of ~34,900,000ms — about 10 hours — against a
   * configured window of 60,000ms. The block marker expires after 60s, but the
   * counter did not, so the very next request was over the limit again and the
   * endpoint re-blocked. It stayed 429 across full process restarts, because the
   * state is in Redis.
   *
   * The fix re-anchors any counter whose TTL exceeds its window. Capping can only
   * ever SHORTEN a window, so throttling is never weakened — it just stops a stale
   * counter from bricking a route for hours.
   */
  it('caps a counter whose TTL outlives its window, so a route cannot stay 429 for hours', async () => {
    redis.store.set('k', '168');
    redis.expiries.set('k', Date.now() + 36_000_000); // ~10h, as seen in the wild

    const rec = await storage.increment('k', 60_000, 100, 0, 'default');

    // Over the limit, so this request is still (correctly) rejected...
    expect(rec.isBlocked).toBe(true);

    // ...but the window is re-anchored to the configured ttl, so the counter and
    // the block now expire together and the route recovers on its own.
    const pexpire = redis.calls.filter((c) => c.cmd === 'pexpire').pop();
    expect(pexpire).toBeDefined();
    expect(pexpire!.args[1]).toBe(60_000);
    expect(await redis.pttl('k')).toBeLessThanOrEqual(60_000);
  });

  it('does not re-anchor a window that is still inside its ttl (fixed, not sliding)', async () => {
    await storage.increment('k', 60_000, 10, 0, 'default');
    const afterFirst = redis.calls.filter((c) => c.cmd === 'pexpire').length;

    await storage.increment('k', 60_000, 10, 0, 'default');
    await storage.increment('k', 60_000, 10, 0, 'default');

    // Re-anchoring on every hit would make the window slide and starve a client
    // under steady traffic — the window must stay anchored to its first request.
    expect(redis.calls.filter((c) => c.cmd === 'pexpire').length).toBe(afterFirst);
  });
});
