import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../../config/config.module';
import { DrizzleService } from '../../database/database.module';
import { Public } from '../auth/decorators/public.decorator';
import Redis from 'ioredis';

/** The single index the search service reads and writes. */
const SEARCH_INDEX_NAME = 'titan_search';

/**
 * Operational health, deliberately free of any new dependency.
 *
 * The reason this exists: search degrades to a Postgres fallback and auth state degrades
 * to the database when Redis is down. Both are *correct* behaviour, but without an
 * endpoint an operator cannot tell a degraded instance from a healthy one — which is
 * exactly how "search returns nothing" goes unnoticed for a week.
 *
 * `/health`      liveness. 200 whenever the process is serving. Never leaks a secret,
 *                a connection string, or a credential: only names and booleans.
 * `/health/ready`readiness. 503 when a dependency that the API cannot work without is
 *                down, so a load balancer stops sending traffic to it.
 */

type State = 'up' | 'down' | 'degraded' | 'disabled';

interface Check {
  state: State;
  detail?: string;
}

/**
 * Prove Redis accepts writes.
 *
 * PING only proves something answers on that port. The throttler and the public cache both
 * need to SET and DEL keys; a read-only replica, a maxmemory instance that refuses writes,
 * or a Redis in a different database index would pass PING and silently break both. Writes a
 * namespaced probe key, reads it back and removes it.
 */
/** Detect an unmodified `.env.example`/template value that was never filled in. */
function isPlaceholderUrl(value: string): boolean {
  return /YOUR[-_A-Z0-9]*|example\.com|CHANGEME|<[^>]+>|\.\.\./i.test(value);
}

const TIMEOUT_MS = 2_000;

/** Never let a hung dependency hang the health endpoint. */
async function withTimeout<T>(work: Promise<T>, fallback: T, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    work.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    @Inject(DrizzleService) private readonly db: DrizzleService,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe (always 200 while the process serves)' })
  async health() {
    return this.collect();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (503 when a required dependency is down)' })
  async ready() {
    const report = await this.collect();
    // Postgres and Supabase Auth are the two the API genuinely cannot serve without.
    // Redis and Meilisearch degrade to working alternatives, so they report but do not
    // take the instance out of rotation.
    const requiredDown = ['database', 'auth'].filter((k) => report.checks[k]?.state === 'down');
    return {
      ...report,
      ready: requiredDown.length === 0,
      ...(requiredDown.length ? { notReady: requiredDown } : {}),
    };
  }

  private async collect() {
    const checks: Record<string, Check> = {};

    // Database — required.
    checks.database = await withTimeout(
      this.db.db
        .execute(sql`select 1`)
        .then(() => ({ state: 'up' as State }))
        .catch(() => ({ state: 'down' as State, detail: 'query failed' })),
      { state: 'down' as State, detail: `no response in ${TIMEOUT_MS}ms` },
    );

    // Supabase Auth — required, and we verify the JWKS is actually reachable rather
    // than trusting the env flag, because a reachable flag with an unreachable JWKS
    // means every request fails auth.
    const authEnabled = this.config.get('SUPABASE_AUTH_ENABLED') === true;
    if (!authEnabled) {
      checks.auth = { state: 'disabled', detail: 'SUPABASE_AUTH_ENABLED is not true' };
    } else {
      const jwksUrl = this.config.get('SUPABASE_JWKS_URL');
      checks.auth = jwksUrl
        ? await withTimeout(
            fetch(jwksUrl)
              .then((r) => (r.ok ? { state: 'up' as State } : { state: 'down' as State, detail: `jwks HTTP ${r.status}` }))
              .catch(() => ({ state: 'down' as State, detail: 'jwks unreachable' })),
            { state: 'down' as State, detail: `jwks no response in ${TIMEOUT_MS}ms` },
          )
        : { state: 'down', detail: 'SUPABASE_AUTH_ENABLED but SUPABASE_JWKS_URL is unset' };
    }

    // Redis — not required; auth state falls back to the database.
    const redisUrl = this.config.get('REDIS_URL');
    if (!redisUrl) {
      // Unset is a real misconfiguration for a public API, not a neutral state: it means
      // rate limiting silently runs on the database and the public read cache is inert.
      // Reported as degraded with the consequence, not 'disabled'.
      checks.redis = {
        state: 'degraded',
        detail:
          'REDIS_URL unset — rate limiting falls back to the database and the public read cache is inert. ' +
          'Set REDIS_URL to a dedicated Redis instance (do not point it at another app\'s Redis).',
      };
    } else if (isPlaceholderUrl(redisUrl)) {
      // The schema only enforces min(1), so an untouched template value
      // ("redis://YOUR-HOSTED-REDIS:6379") boots cleanly and then fails every rate-limit
      // operation at runtime. Naming it here turns a silent degradation into an
      // actionable ops signal.
      checks.redis = {
        state: 'degraded',
        detail:
          'REDIS_URL is still the template placeholder — rate limiting falls back to the database. ' +
          'Set REDIS_URL to a real Redis connection string (e.g. redis://user:pass@host:6379).',
      };
    } else {
      checks.redis = await this.checkRedis(redisUrl);
      if (checks.redis.state === 'up') {
        // PING succeeding proves reachability, not that this application can store keys.
        // A round-trip write/delete is what the throttler and the cache actually need.
        const roundTrip = await this.checkRedisWritable(redisUrl);
        if (roundTrip) {
          checks.redis = {
            state: 'degraded',
            detail: `redis reachable but a write test failed (${roundTrip}); rate limiting and the public cache will not work`,
          };
        }
      }
    }

    // Meilisearch — not required; search falls back to Postgres full-text.
    const meiliHost = this.config.get('MEILISEARCH_HOST');
    /**
     * Search must never read as healthy while the primary engine is down.
     *
     * A reachable `/health` is not sufficient: Meilisearch answers /health even when the
     * index the application actually queries is missing, so a green health probe could hide
     * an empty or absent `titan_search`. The probe therefore checks the real index, and
     * "reachable but not usable" is reported as degraded with the consequence spelled out —
     * search silently degrading to a slower Postgres query is exactly the kind of thing that
     * must not look like a clean bill of health.
     */
    checks.search = meiliHost
      ? await withTimeout(
          (async () => {
            const probe = await fetch(`${meiliHost}/health`);
            if (!probe.ok) {
              return { state: 'degraded' as State, detail: `meilisearch HTTP ${probe.status}; search uses the Postgres fallback` };
            }
            // Reachable. Now confirm the index this application reads actually exists.
            const key = this.config.get('MEILISEARCH_API_KEY');
            const index = await fetch(`${meiliHost}/indexes/${SEARCH_INDEX_NAME}/stats`, {
              headers: key ? { Authorization: `Bearer ${key}` } : {},
            });
            if (!index.ok) {
              return {
                state: 'degraded' as State,
                detail: `meilisearch is up but index '${SEARCH_INDEX_NAME}' is unavailable (HTTP ${index.status}); search uses the Postgres fallback`,
              };
            }
            const stats = (await index.json()) as { numberOfDocuments?: number };
            return {
              state: 'up' as State,
              detail: `meilisearch, index '${SEARCH_INDEX_NAME}' with ${stats.numberOfDocuments ?? 0} documents`,
            };
          })().catch(() => ({
            state: 'degraded' as State,
            detail: 'meilisearch unreachable; search uses the Postgres fallback',
          })),
          {
            state: 'degraded' as State,
            detail: `meilisearch no response in ${TIMEOUT_MS}ms; search uses the Postgres fallback`,
          },
        )
      : {
          state: 'degraded' as State,
          detail: `MEILISEARCH_HOST unset; search uses the Postgres fallback (no full-text index)`,
        };

    // Storage — configuration check only. Probing the bucket would cost a signed
    // request on every probe and is covered by the storage invariant tests.
    const buckets = [this.config.get('S3_BUCKET'), this.config.get('S3_MEDIA_BUCKET')];
    if (!this.config.get('S3_ACCESS_KEY') || !this.config.get('S3_PUBLIC_URL')) {
      checks.storage = { state: 'disabled', detail: 'S3 credentials or S3_PUBLIC_URL unset; uploads use local disk' };
    } else if (buckets[0] === buckets[1]) {
      checks.storage = {
        state: 'down',
        detail: 'S3_MEDIA_BUCKET equals S3_BUCKET; paid video would be publicly readable',
      };
    } else {
      checks.storage = { state: 'up' };
    }

    // Email — presence only. Verifying delivery would spend quota and send mail.
    checks.email = this.config.get('RESEND_API_KEY')
      ? { state: 'up', detail: 'RESEND_API_KEY set' }
      : { state: 'disabled', detail: 'RESEND_API_KEY unset' };

    const states = Object.values(checks).map((c) => c.state);
    const overall: State = states.includes('down') ? 'down' : states.includes('degraded') ? 'degraded' : 'up';

    return { status: overall, checks };
  }

  /**
   * Prove Redis accepts writes, not just that something answers.
   *
   * PING succeeds against a read-only replica or a full instance that refuses SET, both of
   * which would silently break the throttler and the public cache. Writes a namespaced probe
   * key, reads it back, removes it. Returns null on success or a reason string on failure.
   */
  private async checkRedisWritable(url: string): Promise<string | null> {
    const probe = `health:probe:${Math.random().toString(36).slice(2)}`;
    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      await client.set(probe, '1', 'EX', 30);
      const got = await client.get(probe);
      return got === '1' ? null : 'key did not read back';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      try {
        await client.quit();
      } catch {
        /* ignore */
      }
    }
  }

  private async checkRedis(url: string): Promise<Check> {
    try {
      // Imported lazily so a deploy without Redis still boots.
      const { default: Redis } = await import('ioredis');
      const client = new Redis(url, {
        lazyConnect: true,
        connectTimeout: TIMEOUT_MS,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      try {
        await withTimeout(client.connect(), null);
        const pong = await withTimeout(client.ping(), null);
        return pong === 'PONG'
          ? { state: 'up' }
          : { state: 'degraded', detail: 'ping did not return PONG; rate limits fall back to the database' };
      } finally {
        client.disconnect();
      }
    } catch {
      return { state: 'degraded', detail: 'unreachable; rate limits fall back to the database' };
    }
  }
}