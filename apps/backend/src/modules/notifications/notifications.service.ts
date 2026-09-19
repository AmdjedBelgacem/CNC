import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { notifications } from '../../database/schema/notifications';
import { eq, and, desc, count } from 'drizzle-orm';

@Injectable()
export class NotificationsService {
  constructor(private drizzle: DrizzleService) {}

  async findByUser(userId: string) {
    return this.drizzle.db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: desc(notifications.createdAt),
      limit: 50,
    });
  }

  async unreadCount(userId: string) {
    const [result] = await this.drizzle.db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  async markRead(id: string) {
    await this.drizzle.db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllRead(userId: string) {
    await this.drizzle.db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async create(data: {
    userId: string; type: string; title: string; body?: string; data?: Record<string, unknown>;
  }) {
    const [notification] = await this.drizzle.db.insert(notifications).values(data).returning();
    return notification;
  }
}
