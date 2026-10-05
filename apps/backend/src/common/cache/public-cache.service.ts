import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import Redis from 'ioredis';

/**
 * Short-TTL read-through cache for public catalogue data.
 *
 * Motivation, measured: with a 10-connection pool and a single Node process, every
 * anonymous page view of the course list and course detail was a fresh multi-query database
 * round-trip. At 200 virtual users that produced 193 req/s at a 1.18 s p95, with CPU
 * saturated and the pool as the queue — even `/health`, which is one indexed lookup,
 * reported 836 ms p95 because it queued behind the same pool.
 *
 * Catalogue data changes rarely (a published course, an edited description), so a short TTL
 * turns the common case into a Redis GET and removes those queries from the pool entirely.
 *
 * Deliberate properties:
 *  - **Fail open.** Any Redis error returns the miss and the caller queries the database.
 *    A cache outage must never become an outage.
 *  - **Keyed by tenant, locale and every filter**, so a cached listing can never leak
 *    across tenants or serve another locale's content.
 *  - **No user state.** Only responses that are identical for every anonymous visitor are
 *    cached. Anything derived from the session (progress, enrolment, notifications) is
 *    never stored here.
 */
@Injectable()
export class PublicCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(PublicCacheService.name);
  private readonly client: Redis | null;
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;

  /** Local L1. Redis is a network hop; the hot keys are the same few dozen on every page. */
  private readonly l1 = new Map<string, { value: string; expires: number }>();
  private readonly l1Max = 500;

  constructor(config: ConfigService) {
    this.enabled = config.get('PUBLIC_CACHE_ENABLED') ?? true;
    this.defaultTtlSeconds = config.get('PUBLIC_CACHE_TTL_SECONDS') ?? 60;
    const url = config.get('REDIS_URL');
    this.client =
      this.enabled && url
        ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
        : null;
    if (this.enabled && !url) {
      this.logger.warn('Public cache disabled: REDIS_URL unset');
    } else if (!this.enabled) {
      this.logger.warn('Public cache disabled: PUBLIC_CACHE_ENABLED=false');
    }
  }

  /** Stable cache key from its parts. Filter objects are sorted so key order is irrelevant. */
  buildKey(namespace: string, tenantId: string, locale: string | undefined, params?: Record<string, unknown>): string {
    const parts: string[] = [namespace, tenantId, locale ?? 'en'];
    if (params) {
      for (const key of Object.keys(params).sort()) {
        const value = params[key];
        if (value === undefined || value === null || value === '') continue;
        parts.push(`${key}=${String(value)}`);
      }
    }
    return `pc:${parts.join('|')}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    const local = this.l1.get(key);
    if (local) {
      if (local.expires > now) return JSON.parse(local.value) as T;
      this.l1.delete(key);
    }

    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      this.remember(key, raw, this.defaultTtlSeconds);
      return JSON.parse(raw) as T;
    } catch {
      // Fail open: an unreachable cache is a miss, never an error.
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const raw = JSON.stringify(value);
    this.remember(key, raw, ttl);
    if (!this.client) return;
    try {
      await this.client.set(key, raw, 'EX', ttl);
    } catch {
      /* fail open */
    }
  }

  /** Drop keys under a namespace prefix, e.g. after an admin edits a course. */
  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of [...this.l1.keys()]) {
      if (key.startsWith(prefix)) this.l1.delete(key);
    }
    if (!this.client) return;
    try {
      // SCAN rather than KEYS: KEYS blocks the Redis event loop, which is exactly the wrong
      // thing to do on the hot path.
      let cursor = '0';
      do {
        const [next, found] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (found.length > 0) await this.client.del(...found);
      } while (cursor !== '0');
    } catch {
      /* fail open */
    }
  }

  private remember(key: string, raw: string, ttlSeconds: number): void {
    if (this.l1.size >= this.l1Max) {
      // Cheap eviction: drop the oldest insertion. Map preserves insertion order.
      const oldest = this.l1.keys().next();
      if (!oldest.done) this.l1.delete(oldest.value);
    }
    this.l1.set(key, { value: raw, expires: Date.now() + ttlSeconds * 1000 });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit();
    } catch {
      /* ignore */
    }
  }
}
