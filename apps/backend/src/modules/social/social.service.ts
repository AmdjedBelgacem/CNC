import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users, follows, userPortfolioItems } from '../../database/schema/users';
import { posts } from '../../database/schema/posts';
import { eq, and, desc, count, ilike, or } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SocialService {
  constructor(
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
  ) {}

  async getProfile(tenantId: string, userId: string, currentUserId?: string) {
    const profile = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
      columns: {
        id: true, name: true, headline: true, bio: true, avatarUrl: true,
        location: true, role: true, createdAt: true,
      },
    });
    if (!profile) throw new NotFoundException('User not found');

    const [followerCount] = await this.drizzle.db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingCount] = await this.drizzle.db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const [postCount] = await this.drizzle.db
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.userId, userId));

    const isFollowing = currentUserId
      ? await this.drizzle.db.query.follows.findFirst({
          where: and(eq(follows.followerId, currentUserId), eq(follows.followingId, userId)),
        })
      : null;

    const portfolioItems = await this.drizzle.db.query.userPortfolioItems.findMany({
      where: eq(userPortfolioItems.userId, userId),
      orderBy: desc(userPortfolioItems.createdAt),
    });

    return {
      ...profile,
      followerCount: followerCount?.count ?? 0,
      followingCount: followingCount?.count ?? 0,
      postCount: postCount?.count ?? 0,
      isFollowing: !!isFollowing,
      portfolioItems,
    };
  }

  async updateProfile(userId: string, data: { name?: string; headline?: string; bio?: string; avatarUrl?: string; location?: string }) {
    const [user] = await this.drizzle.db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ConflictException('Cannot follow yourself');

    const existing = await this.drizzle.db.query.follows.findFirst({
      where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)),
    });
    if (existing) throw new ConflictException('Already following');

    await this.drizzle.db.insert(follows).values({ followerId, followingId });

    await this.notifications.create({
      userId: followingId,
      type: 'follow',
      title: 'Someone started following you',
      data: { actorId: followerId },
    });

    return { following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.drizzle.db.delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return { following: false };
  }

  async addPortfolioItem(userId: string, data: { title: string; description?: string; imageUrl?: string; tags?: string[] }) {
    const [item] = await this.drizzle.db.insert(userPortfolioItems)
      .values({ userId, ...data })
      .returning();
    return item;
  }

  async searchUsers(tenantId: string, query: string) {
    return this.drizzle.db.query.users.findMany({
      where: and(
        eq(users.tenantId, tenantId),
        or(ilike(users.name, `%${query}%`), ilike(users.headline, `%${query}%`), ilike(users.bio, `%${query}%`)),
      ),
      columns: { id: true, name: true, avatarUrl: true, headline: true },
      limit: 20,
    });
  }
}
