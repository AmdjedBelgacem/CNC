import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../../../config/config.service';

/**
 * Redis-backed ThrottlerStorage for @nestjs/throttler v6.
 *
 * v6 contract (see node_modules/@nestjs/throttler/dist/throttler.guard.js:116-133):
 *   increment(key, ttl, limit, blockDuration, throttlerName) => {
 *     totalHits, timeToExpire, isBlocked, timeToBlockExpire
 *   }
 * The guard throws ThrottlerException **only when `isBlocked === true`**.
 *
 * Units — this is where the previous implementation went wrong:
 *   - `ttl` and `blockDuration` arrive in **MILLISECONDS** (do NOT multiply by 1000).
 *   - `timeToExpire` / `timeToBlockExpire` must be returned in **SECONDS**.
 */
@Injectable()
export class RedisThrottlerStorage implements OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private redis: Redis | null;
  /** Used only when no Redis is configured, so limits still apply per process. */
  private readonly memory = new Map<
    string,
    { hits: number; expiresAt: number; blockedUntil: number }
  >();

  constructor(config: ConfigService) {
    const url = config.get('REDIS_URL');
    if (!url) {
      // Previously this fell through to `new Redis(undefined)`, which connects to
      // localhost:6379 — silently throttling against whatever happened to be listening
      // there, or failing open. With REDIS_URL now optional that is a live hazard, so the
      // absence of Redis is handled explicitly instead.
      this.logger.warn('REDIS_URL not configured — rate limiting uses an in-process counter');
      this.redis = null;
      return;
    }
    this.redis = new Redis(url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
    });
    this.redis.on('error', (err) => this.logger.warn(`Redis throttler error: ${err.message}`));
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName?: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    // `ttl` is already in milliseconds. blockDuration falls back to ttl when unset.
    const blockTtlMs = blockDuration && blockDuration > 0 ? blockDuration : ttl;
    const blockKey = `${key}:blocked`;

    // Captured in a local so TypeScript keeps the non-null narrowing across the await
    // points below; `this.redis` is mutable and would otherwise widen back to nullable.
    const redis = this.redis;
    if (!redis) return this.incrementInMemory(key, ttl, limit, blockTtlMs);

    try {
      // Already serving a block window? Report blocked without incrementing further.
      const blockPttl = await redis.pttl(blockKey);
      if (blockPttl > 0) {
        const hits = await redis.get(key);
        return {
          totalHits: hits ? parseInt(hits, 10) : limit + 1,
          timeToExpire: Math.ceil(ttl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockPttl / 1000),
        };
      }

      const count = await redis.incr(key);
      let pttl = await redis.pttl(key);
      // (Re)assert the window.
      //   count === 1  — a fresh key was just created by INCR, so it has no expiry.
      //   pttl < 0     — the key exists but has no expiry (INCR preserves TTLs, so
      //                  this only happens on a key we did not create).
      //   pttl > ttl   — the key outlives its own window. This is the one that
      //                  matters: a counter written with a longer TTL (an older
      //                  build, or another process sharing this Redis that happens
      //                  to hash to the same key) stays alive far past its window.
      //                  Once such a counter passes `limit` the endpoint is stuck
      //                  at 429 for the whole TTL, because the block expires but
      //                  the counter does not. Capping the TTL can only ever
      //                  SHORTEN a window, so rate limiting is never weakened.
      if (count === 1 || pttl < 0 || pttl > ttl) {
        await redis.pexpire(key, ttl);
        pttl = ttl;
      }

      const timeToExpire = Math.ceil((pttl > 0 ? pttl : ttl) / 1000);

      if (count > limit) {
        await redis.psetex(blockKey, blockTtlMs, '1');
        return {
          totalHits: count,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
        };
      }

      return { totalHits: count, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    } catch (err) {
      // Fail OPEN: a Redis outage must not 500 the whole API. Log loudly so it is visible.
      this.logger.warn(
        `Throttler storage unavailable (${(err as Error).message}) — allowing request for key ${key}`,
      );
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async get(key: string): Promise<number> {
    const redis = this.redis;
    if (!redis) {
      const entry = this.memory.get(key);
      return entry && entry.expiresAt > Date.now() ? entry.hits : 0;
    }
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  async reset(key: string): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      this.memory.delete(key);
      return;
    }
    await redis.del(key, `${key}:blocked`);
  }

  async onModuleDestroy() {
    try {
      await this.redis?.quit();
    } catch {}
  }

  /**
   * Same contract as the Redis path, held in process memory.
   *
   * Keeps the v6 contract (ttl in ms in, seconds out, `isBlocked` only when actually
   * blocked) so the guard behaves identically without Redis. Per-process by nature, which
   * is the accepted trade-off: it is weaker than a shared counter, and the warning at
   * construction says so.
   */
  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockTtlMs: number,
  ): { totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number } {
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { hits: 1, expiresAt: now + ttl, blockedUntil: 0 });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
    if (entry.blockedUntil > now) {
      return {
        totalHits: entry.hits,
        timeToExpire: Math.ceil(Math.max(entry.expiresAt - now, 0) / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }
    entry.hits += 1;
    // Cap the window so a long-TTL counter cannot pin an endpoint at 429, matching Redis.
    entry.expiresAt = Math.min(entry.expiresAt, now + ttl);
    if (entry.hits > limit) entry.blockedUntil = now + blockTtlMs;
    return {
      totalHits: entry.hits,
      timeToExpire: Math.ceil(Math.max(entry.expiresAt - now, 0) / 1000),
      isBlocked: entry.blockedUntil > now,
      timeToBlockExpire:
        entry.blockedUntil > now ? Math.ceil((entry.blockedUntil - now) / 1000) : 0,
    };
  }
}
