import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Per-user ceiling on wrong second-factor codes.
 *
 * The route throttle is per IP, so an attacker holding the password (and therefore a
 * pending-2FA cookie) could rotate addresses and keep guessing a 6-digit code. This
 * counter is keyed on the account instead: after MAX_FAILURES wrong codes, verification
 * for that account is refused for LOCK_SECONDS, whoever is asking.
 *
 * Redis carries the count so every instance sees it; without Redis an in-process map is
 * used, which still bounds a single instance.
 */
export const TWO_FACTOR_MAX_FAILURES = 10;
export const TWO_FACTOR_LOCK_SECONDS = 15 * 60;

const key = (userId: string) => `2fa_fail:${userId}`;

@Injectable()
export class TwoFactorAttemptsService {
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  private async read(userId: string): Promise<number> {
    const client = this.redis?.client;
    if (client) {
      try {
        const raw = await client.get(key(userId));
        return raw ? Number(raw) || 0 : 0;
      } catch {
        // Fall through to the in-process count.
      }
    }
    const entry = this.memory.get(key(userId));
    if (!entry) return 0;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key(userId));
      return 0;
    }
    return entry.count;
  }

  /** Throws 429 while the account's second factor is locked. */
  async assertNotLocked(userId: string): Promise<void> {
    if ((await this.read(userId)) >= TWO_FACTOR_MAX_FAILURES) {
      throw new HttpException(
        'Too many invalid verification codes. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Records one wrong code. The window restarts at the lock, so the lock lasts the full period. */
  async recordFailure(userId: string): Promise<number> {
    const client = this.redis?.client;
    if (client) {
      try {
        const count = await client.incr(key(userId));
        if (count === 1 || count >= TWO_FACTOR_MAX_FAILURES) {
          await client.expire(key(userId), TWO_FACTOR_LOCK_SECONDS);
        }
        return count;
      } catch {
        // Fall through to the in-process count.
      }
    }
    const now = Date.now();
    const current = this.memory.get(key(userId));
    const count = current && current.expiresAt > now ? current.count + 1 : 1;
    const restart = count === 1 || count >= TWO_FACTOR_MAX_FAILURES;
    this.memory.set(key(userId), {
      count,
      expiresAt: restart ? now + TWO_FACTOR_LOCK_SECONDS * 1000 : current!.expiresAt,
    });
    return count;
  }

  async reset(userId: string): Promise<void> {
    this.memory.delete(key(userId));
    const client = this.redis?.client;
    if (client) {
      try {
        await client.del(key(userId));
      } catch {
        // Expiry clears it anyway.
      }
    }
  }
}
