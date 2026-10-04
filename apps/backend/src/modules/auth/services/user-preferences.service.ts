import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../../database/drizzle.service';
import { userPreferences } from '../../../database/schema/user-preferences';
import { eq } from 'drizzle-orm';
import type { ThemeTokens } from '@titan/shared';

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
    const existing = await this.drizzle.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (!existing) {
      const [created] = await this.drizzle.db.insert(userPreferences).values({ userId, ...data }).returning();
      return created;
    }
    const [updated] = await this.drizzle.db.update(userPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return updated;
  }
}
