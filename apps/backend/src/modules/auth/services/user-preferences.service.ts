import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { userPreferences } from '../../../database/schema/user-preferences';
import { eq } from 'drizzle-orm';
import type { ThemeTokens } from '@titan/shared';

/** The only columns a caller may write. */
export const PREFERENCE_FIELDS = [
  'theme', 'density', 'profileVisibility', 'whoCanMessage', 'whoCanFollow',
  'emailNotifications', 'inAppNotifications', 'themeTokens',
] as const;

@Injectable()
export class UserPreferencesService {
  constructor(private drizzle: DrizzleService) {}

  async get(userId: string) {
    let prefs = await this.drizzle.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (!prefs) {
      const [created] = await this.drizzle.db.insert(userPreferences).values({ userId }).returning();
      prefs = created;
    }
    return prefs;
  }

  async update(userId: string, data: Partial<{
    theme: string; density: string; profileVisibility: string;
    whoCanMessage: string; whoCanFollow: string;
    emailNotifications: Record<string, boolean>; inAppNotifications: Record<string, boolean>;
    themeTokens: ThemeTokens | null;
  }>) {
    /**
     * Copied key by key, never spread: the body used to be spread into the insert/set, so a
     * `userId` (or `id`) in it was written too and one account could overwrite another's row.
     * `userId` comes only from the authenticated caller.
     */
    const values: Partial<typeof userPreferences.$inferInsert> = {};
    for (const field of PREFERENCE_FIELDS) {
      if (data?.[field] !== undefined) (values as Record<string, unknown>)[field] = data[field];
    }
    const existing = await this.drizzle.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (!existing) {
      const [created] = await this.drizzle.db.insert(userPreferences).values({ ...values, userId }).returning();
      return created;
    }
    const [updated] = await this.drizzle.db.update(userPreferences)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return updated;
  }
}
