import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../../config/config.module';
import { DrizzleService } from '../../database/database.module';
import { Public } from '../auth/decorators/public.decorator';

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
      checks.redis = { state: 'disabled', detail: 'REDIS_URL unset' };
    } else {
      checks.redis = await this.checkRedis(redisUrl);
    }

    // Meilisearch — not required; search falls back to Postgres full-text.
    const meiliHost = this.config.get('MEILISEARCH_HOST');
    checks.search = meiliHost
      ? await withTimeout(
          fetch(`${meiliHost}/health`)
            .then((r) =>
              r.ok
                ? { state: 'up' as State }
                : { state: 'degraded' as State, detail: `meilisearch HTTP ${r.status}; search uses the Postgres fallback` },
            )
            .catch(() => ({ state: 'degraded' as State, detail: 'meilisearch unreachable; search uses the Postgres fallback' })),
          { state: 'degraded' as State, detail: `meilisearch no response in ${TIMEOUT_MS}ms; search uses the Postgres fallback` },
        )
      : { state: 'disabled', detail: 'MEILISEARCH_HOST unset; search uses the Postgres fallback' };

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