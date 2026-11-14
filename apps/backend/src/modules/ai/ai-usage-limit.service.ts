import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { RedisService } from '../auth/services/redis.service';

/**
 * Daily ceilings on AI assistant requests, so no single user, visitor or tenant can run up
 * unbounded provider spend.
 *
 * The route throttles are per IP and per minute: a user rotating addresses, or a steady
 * script under the per-minute rate, could still call the provider all day at the tenant's
 * `maxTokens`. These counters are per UTC day and keyed on who is asking:
 *   - a signed-in user (admins are exempt from the per-user cap, not from the tenant cap),
 *   - an anonymous visitor of the public assistant (by IP, the real visitor address),
 *   - the whole tenant, as a backstop for everything together.
 *
 * Redis carries the counts so every instance shares them; without Redis an in-process map
 * still bounds a single instance. Limits come from env so they can be tuned without a deploy.
 */
export interface AiUsageSubject {
  tenantId: string;
  userId?: string | null;
  role?: string | null;
  ip?: string | null;
}

const DAY_SECONDS = 26 * 60 * 60; // a little over a day, so a key outlives its UTC date

function limitFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function aiUsageLimits() {
  return {
    perUser: limitFromEnv('AI_DAILY_LIMIT_PER_USER', 200),
    perVisitor: limitFromEnv('AI_DAILY_LIMIT_PER_VISITOR', 40),
    perTenant: limitFromEnv('AI_DAILY_LIMIT_PER_TENANT', 3000),
  };
}

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

@Injectable()
export class AiUsageLimitService {
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  /** Counts one request and throws 429 when any ceiling that applies is already used up. */
  async consume(subject: AiUsageSubject, now = new Date()): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    const limits = aiUsageLimits();
    const checks: Array<{ key: string; limit: number; message: string }> = [];

    if (subject.userId) {
      if (!ADMIN_ROLES.has(String(subject.role ?? ''))) {
        checks.push({
          key: `ai_day:${day}:user:${subject.userId}`,
          limit: limits.perUser,
          message: 'You have reached today’s limit for the assistant. It resets tomorrow.',
        });
      }
    } else if (subject.ip) {
      checks.push({
        key: `ai_day:${day}:visitor:${subject.tenantId}:${subject.ip}`,
        limit: limits.perVisitor,
        message: 'The assistant has reached today’s limit for visitors. Sign in or try again tomorrow.',
      });
    }
    checks.push({
      key: `ai_day:${day}:tenant:${subject.tenantId}`,
      limit: limits.perTenant,
      message: 'The assistant is busy today. Please try again tomorrow.',
    });

    for (const check of checks) {
      const count = await this.increment(check.key);
      if (count > check.limit) {
        throw new HttpException(check.message, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  private async increment(key: string): Promise<number> {
    const client = this.redis?.client;
    if (client) {
      try {
        const count = await client.incr(key);
        if (count === 1) await client.expire(key, DAY_SECONDS);
        return count;
      } catch {
        // Fall through to the in-process count.
      }
    }
    const now = Date.now();
    const current = this.memory.get(key);
    const count = current && current.expiresAt > now ? current.count + 1 : 1;
    this.memory.set(key, { count, expiresAt: count === 1 ? now + DAY_SECONDS * 1000 : current!.expiresAt });
    if (this.memory.size > 10_000) {
      for (const [k, v] of this.memory) if (v.expiresAt <= now) this.memory.delete(k);
    }
    return count;
  }
}
