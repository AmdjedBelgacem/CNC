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
  private redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get('REDIS_URL'), {
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
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    // `ttl` is already in milliseconds. blockDuration falls back to ttl when unset.
    const blockTtlMs = blockDuration && blockDuration > 0 ? blockDuration : ttl;
    const blockKey = `${key}:blocked`;

    try {
      // Already serving a block window? Report blocked without incrementing further.
      const blockPttl = await this.redis.pttl(blockKey);
      if (blockPttl > 0) {
        const hits = await this.redis.get(key);
        return {
          totalHits: hits ? parseInt(hits, 10) : limit + 1,
          timeToExpire: Math.ceil(ttl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockPttl / 1000),
        };
      }

      const count = await this.redis.incr(key);
      let pttl = await this.redis.pttl(key);
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
        await this.redis.pexpire(key, ttl);
        pttl = ttl;
      }

      const timeToExpire = Math.ceil((pttl > 0 ? pttl : ttl) / 1000);

      if (count > limit) {
        await this.redis.psetex(blockKey, blockTtlMs, '1');
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
      return { totalHits: 0, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  async get(key: string): Promise<number> {
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key, `${key}:blocked`);
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {}
  }
}
