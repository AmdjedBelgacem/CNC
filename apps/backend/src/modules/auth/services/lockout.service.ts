import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { users } from '../../../database/schema/users';
import { failedLoginAttempts } from '../../../database/schema/auth';
import { eq, lte } from 'drizzle-orm';

@Injectable()
export class LockoutService {
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000;
  private readonly LOCKOUT_DURATION_ESCALATED = 60 * 60 * 1000;

  constructor(private drizzle: DrizzleService) {}

  async recordFailedAttempt(email: string, ip: string, userAgent?: string): Promise<{ locked: boolean; remainingAttempts: number }> {
    await this.drizzle.db.insert(failedLoginAttempts).values({
      email,
      ip,
      userAgent: userAgent || null,
    });

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      const newCount = (user.failedLoginAttempts || 0) + 1;
      await this.drizzle.db
        .update(users)
        .set({ failedLoginAttempts: newCount })
        .where(eq(users.id, user.id));

      if (newCount >= this.MAX_ATTEMPTS) {
        const duration = newCount >= this.MAX_ATTEMPTS * 2
          ? this.LOCKOUT_DURATION_ESCALATED
          : this.LOCKOUT_DURATION;

        const lockedUntil = new Date(Date.now() + duration);
        await this.drizzle.db
          .update(users)
          .set({ lockedUntil, accountStatus: 'locked' })
          .where(eq(users.id, user.id));

        return { locked: true, remainingAttempts: 0 };
      }

      return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - newCount };
    }

    return { locked: false, remainingAttempts: this.MAX_ATTEMPTS };
  }

  async isLocked(email: string): Promise<{ locked: boolean; lockedUntil: Date | null }> {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.lockedUntil) {
      return { locked: false, lockedUntil: null };
    }

    if (new Date() > new Date(user.lockedUntil)) {
      await this.drizzle.db
        .update(users)
        .set({ lockedUntil: null, accountStatus: 'active', failedLoginAttempts: 0 })
        .where(eq(users.id, user.id));
      return { locked: false, lockedUntil: null };
    }

    return { locked: true, lockedUntil: user.lockedUntil };
  }

  async resetAttempts(userId: string): Promise<void> {
    await this.drizzle.db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, accountStatus: 'active' })
      .where(eq(users.id, userId));
  }

  async cleanupOldAttempts(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.drizzle.db
      .delete(failedLoginAttempts)
      .where(lte(failedLoginAttempts.attemptedAt, cutoff));
  }
}
