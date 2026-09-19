import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { posts, postLikes, comments } from '../../database/schema/posts';
import { users } from '../../database/schema/users';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeedService {
  constructor(
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
  ) {}

  async getFeed(tenantId: string, page = 1, limit = 20, currentUserId?: string) {
    const data = await this.drizzle.db.query.posts.findMany({
      where: and(eq(posts.tenantId, tenantId), eq(posts.isPublic, true)),
      orderBy: [desc(posts.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: {
        user: { columns: { id: true, name: true, avatarUrl: true, headline: true } },
        likes: { columns: { userId: true } },
        comments: {
          limit: 2,
          orderBy: [desc(comments.createdAt)],
          with: { user: { columns: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    const totalArr = await this.drizzle.db
      .select({ count: count() })
      .from(posts)
      .where(and(eq(posts.tenantId, tenantId), eq(posts.isPublic, true)));

    return {
      data: data.map((p) => ({
        ...p,
        likedByMe: currentUserId ? p.likes.some((l) => l.userId === currentUserId) : false,
        likes: undefined,
        likeCount: p.likes.length,
      })),
      total: totalArr[0]?.count || 0,
      page,
      limit,
    };
  }

  async getUserFeed(userId: string, page = 1, limit = 20) {
    const followsList = await this.drizzle.db.query.follows.findMany({
      where: (f, { eq }) => eq(f.followerId, userId),
      columns: { followingId: true },
    });
    const followedIds = followsList.map((f) => f.followingId);
    if (followedIds.length === 0) return [];

    const data = await this.drizzle.db.query.posts.findMany({
      where: and(
        eq(posts.isPublic, true),
        inArray(posts.userId, followedIds),
      ),
      orderBy: [desc(posts.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: {
        user: { columns: { id: true, name: true, avatarUrl: true, headline: true } },
        likes: { columns: { userId: true } },
        comments: {
          limit: 2,
          orderBy: [desc(comments.createdAt)],
          with: { user: { columns: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    return data.map((p) => ({
      ...p,
      likedByMe: p.likes.some((l) => l.userId === userId),
      likes: undefined,
      likeCount: p.likes.length,
    }));
  }

  async createPost(data: {
    userId: string; tenantId: string; content: string;
    mediaUrls?: string[]; tags?: string[]; isPublic?: boolean;
  }) {
    const [post] = await this.drizzle.db.insert(posts).values(data).returning();
    return post;
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.drizzle.db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not your post');
    await this.drizzle.db.delete(posts).where(eq(posts.id, postId));
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.drizzle.db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.drizzle.db.query.postLikes.findFirst({
      where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
    });

    if (existing) {
      await this.drizzle.db.delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
      await this.drizzle.db.update(posts)
        .set({ likeCount: sql`${posts.likeCount} - 1` })
        .where(eq(posts.id, postId));
      return { liked: false };
    }

    await this.drizzle.db.insert(postLikes).values({ postId, userId });
    await this.drizzle.db.update(posts)
      .set({ likeCount: sql`${posts.likeCount} + 1` })
      .where(eq(posts.id, postId));

    if (post.userId !== userId) {
      await this.notifications.create({
        userId: post.userId,
        type: 'like',
        title: 'Someone liked your post',
        data: { postId, actorId: userId },
      });
    }

    return { liked: true };
  }

  async addComment(postId: string, userId: string, content: string) {
    const post = await this.drizzle.db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });
    if (!post) throw new NotFoundException('Post not found');

    const [comment] = await this.drizzle.db.insert(comments)
      .values({ postId, userId, content })
      .returning();

    await this.drizzle.db.update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true },
    });

    if (post.userId !== userId) {
      await this.notifications.create({
        userId: post.userId,
        type: 'comment',
        title: `${user?.name || 'Someone'} commented on your post`,
        data: { postId, commentId: comment!.id, actorId: userId },
      });
    }

    return {
      ...comment!,
      user: { id: userId, name: user?.name, avatarUrl: null },
    };
  }

  async getComments(postId: string, page = 1, limit = 20) {
    return this.drizzle.db.query.comments.findMany({
      where: eq(comments.postId, postId),
      orderBy: [desc(comments.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: { user: { columns: { id: true, name: true, avatarUrl: true } } },
    });
  }
}
