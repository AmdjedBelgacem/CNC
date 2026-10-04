import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { commentVotes, comments, postTags, postVotes, posts, tags } from '../../database/schema/posts';
import { follows, users } from '../../database/schema/users';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';

export type FeedSort = 'hot' | 'new' | 'top';
export type CommentSort = 'best' | 'new' | 'old';

/** Deepest reply level kept. Beyond this a reply attaches to the last visible level. */
export const MAX_COMMENT_DEPTH = 6;
const MAX_TAGS_PER_POST = 8;
const MAX_TAG_LENGTH = 40;
const MAX_COMMENT_LENGTH = 4000;

/** The author fields the UI needs to render a person, not a placeholder. */
const AUTHOR_COLUMNS = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  headline: true,
  role: true,
} as const;

/**
 * Feed reads and writes.
 *
 * Every method takes the tenant and filters on it. That is not decoration: the
 * previous implementation looked posts up by id alone, so any authenticated
 * member could read, like or comment on another tenant's post by guessing a UUID.
 */
@Injectable()
export class FeedService {
  constructor(
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
    private search?: SearchService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async getFeed(
    tenantId: string,
    page = 1,
    limit = 20,
    currentUserId?: string,
    options: { sort?: FeedSort; tag?: string } = {},
  ) {
    const sort: FeedSort = options.sort === 'top' || options.sort === 'new' ? options.sort : 'hot';
    const tagSlug = options.tag ? this.normalizeTag(options.tag) : null;

    const tagIds = tagSlug
      ? (await this.drizzle.db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.tenantId, tenantId), eq(tags.slug, tagSlug)))
          .limit(1))
          .map((row) => row.id)
      : [];

    // An unknown tag is an empty feed, not the whole feed. Silently ignoring it
    // would show a member posts that do not carry the tag they asked for.
    if (tagSlug && tagIds.length === 0) {
      return { data: [], total: 0, page, limit, sort, tag: tagSlug };
    }

    const where = and(
      eq(posts.tenantId, tenantId),
      eq(posts.isPublic, true),
      tagIds.length ? inArray(posts.id, this.drizzle.db.select({ postId: postTags.postId }).from(postTags).where(inArray(postTags.tagId, tagIds))) : undefined,
    );

    const orderBy =
      sort === 'new'
        ? [desc(posts.createdAt)]
        : sort === 'top'
          ? [desc(posts.score), desc(posts.createdAt)]
          : // "Hot" is score with a recency nudge, so a strong old post still
            // surfaces but a flood of identical new posts cannot own the page.
            [desc(sql`${posts.score} + (extract(epoch from (now() - ${posts.createdAt})) / 3600)`), desc(posts.createdAt)];

    const data = await this.drizzle.db.query.posts.findMany({
      where,
      orderBy,
      limit,
      offset: (page - 1) * limit,
      with: {
        user: { columns: AUTHOR_COLUMNS },
        votes: { columns: { userId: true, value: true } },
        postTags: { with: { tag: { columns: { id: true, slug: true, label: true } } } },
      },
    });

    const [totalRow] = await this.drizzle.db
      .select({ count: count() })
      .from(posts)
      .where(where);

    return {
      data: data.map((post) => this.presentPost(post, currentUserId)),
      total: totalRow?.count ?? 0,
      page,
      limit,
      sort,
      tag: tagSlug,
    };
  }

  /** Posts from the people this member follows, newest first. */
  async getUserFeed(userId: string, page = 1, limit = 20, tenantId?: string, currentUserId?: string) {
    const followed = await this.drizzle.db.query.follows.findMany({
      where: eq(follows.followerId, userId),
      columns: { followingId: true },
    });
    const followedIds = followed.map((entry) => entry.followingId);
    if (followedIds.length === 0) return { data: [], total: 0, page, limit };
    return this.getFeedForUsers(followedIds, { page, limit, tenantId, currentUserId });
  }

  /** Posts written by a set of authors, used by the profile and "my posts" views. */
  async getFeedForUsers(
    userIds: string[],
    options: { page?: number; limit?: number; tenantId?: string; currentUserId?: string; sort?: FeedSort } = {},
  ) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    if (userIds.length === 0) return { data: [], total: 0, page, limit };

    const rows = await this.drizzle.db.query.posts.findMany({
      where: and(
        eq(posts.isPublic, true),
        inArray(posts.userId, userIds),
        options.tenantId ? eq(posts.tenantId, options.tenantId) : undefined,
      ),
      orderBy: [desc(posts.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: {
        user: { columns: AUTHOR_COLUMNS },
        votes: { columns: { userId: true, value: true } },
        postTags: { with: { tag: { columns: { id: true, slug: true, label: true } } } },
      },
    });

    return {
      data: rows.map((post) => this.presentPost(post, options.currentUserId)),
      total: rows.length,
      page,
      limit,
    };
  }

  // -------------------------------------------------------------------------
  // Votes
  // -------------------------------------------------------------------------

  /**
   * Cast, switch or withdraw a vote.
   *
   * `value` 1 or -1 replaces any existing vote; `value` 0 withdraws. Counters are
   * derived from the stored vote inside the same transaction as the write, so a
   * crash between the two cannot leave a score that disagrees with the votes.
   */
  async votePost(tenantId: string, postId: string, userId: string, value: number) {
    if (![1, -1, 0].includes(value)) throw new BadRequestException('Vote must be 1, -1 or 0');

    const post = await this.findPost(tenantId, postId);

    // Self-voting is how a score gets gamed, and it is never information.
    if (String(post.userId) === String(userId)) {
      throw new ForbiddenException('You cannot vote on your own post');
    }

    const previous = await this.drizzle.db.query.postVotes.findFirst({
      where: and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)),
    });

    await this.drizzle.db.transaction(async (tx) => {
      if (value === 0) {
        if (previous) {
          await tx.delete(postVotes).where(and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)));
        }
      } else {
        await tx
          .insert(postVotes)
          .values({ postId, userId, value })
          .onConflictDoUpdate({
            target: [postVotes.postId, postVotes.userId],
            set: { value, createdAt: new Date() },
          });
      }
      await this.refreshPostCounters(tx as never, postId);
    });

    if (value === 1 && (!previous || previous.value !== 1)) {
      void this.notifications
        .notifyUser({
          tenantId,
          userId: post.userId,
          type: 'like',
          category: 'social',
          title: 'Someone upvoted your post',
          body: 'Your post received an upvote.',
          href: `/feed?post=${postId}`,
          actorId: userId,
          entityType: 'post',
          entityId: postId,
          idempotencyKey: `like:${tenantId}:${postId}:${userId}`,
        })
        .catch(() => {});
    }

    const [updated] = await this.drizzle.db
      .select({ score: posts.score, likeCount: posts.likeCount, downvoteCount: posts.downvoteCount })
      .from(posts)
      .where(eq(posts.id, postId));

    return {
      score: updated?.score ?? 0,
      upvotes: updated?.likeCount ?? 0,
      downvotes: updated?.downvoteCount ?? 0,
      myVote: value,
    };
  }

  /** Recompute a post's counters from its votes. Called inside the vote transaction. */
  private async refreshPostCounters(tx: { execute: (q: unknown) => Promise<unknown> }, postId: string) {
    await tx.execute(sql`
      update ${posts} p
      set like_count = agg.up,
          downvote_count = agg.down,
          score = agg.up - agg.down
      from (
        select
          count(*) filter (where value > 0)::int as up,
          count(*) filter (where value < 0)::int as down
        from ${postVotes}
        where ${postVotes.postId} = ${postId}
      ) agg
      where p.id = ${postId}
    `);
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  /**
   * A whole post's comment tree in one query, assembled in memory.
   *
   * Reddit-style: every comment carries its replies, so the client renders a tree
   * without N+1 round trips. `sort` orders siblings only — a thread always reads
   * parent-then-children.
   */
  async getComments(
    tenantId: string,
    postId: string,
    currentUserId?: string,
    options: { sort?: CommentSort; limit?: number } = {},
  ) {
    await this.findPost(tenantId, postId);
    const sort: CommentSort = options.sort === 'new' || options.sort === 'old' ? options.sort : 'best';
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

    const rows = await this.drizzle.db.query.comments.findMany({
      where: eq(comments.postId, postId),
      orderBy: sort === 'old' ? [asc(comments.createdAt)] : sort === 'new' ? [desc(comments.createdAt)] : [desc(comments.score), asc(comments.createdAt)],
      limit,
      with: {
        user: { columns: AUTHOR_COLUMNS },
        votes: { columns: { userId: true, value: true } },
      },
    });

    type Node = ReturnType<FeedService['presentComment']> & { replies: Node[] };
    const byId = new Map<string, Node>();
    const roots: Node[] = [];

    for (const row of rows) {
      const node = { ...this.presentComment(row, currentUserId), replies: [] as Node[] };
      byId.set(node.id, node);
    }
    for (const node of byId.values()) {
      const row = rows.find((candidate) => candidate.id === node.id)!;
      const parentId = row.parentId;
      const parent = parentId ? byId.get(parentId) : undefined;
      // A reply whose parent fell outside the limit is promoted to a root rather
      // than dropped: losing a comment because its parent was truncated is worse.
      if (parent && parent.id !== node.id) parent.replies.push(node);
      else roots.push(node);
    }

    const countNodes = (nodes: Node[]): number =>
      nodes.reduce((sum, node) => sum + 1 + countNodes(node.replies), 0);

    return {
      data: roots,
      total: countNodes(roots),
      sort,
      postId,
    };
  }

  async addComment(
    tenantId: string,
    postId: string,
    userId: string,
    content: string,
    parentId?: string | null,
  ) {
    const post = await this.findPost(tenantId, postId);
    const body = String(content ?? '').trim();
    if (!body) throw new BadRequestException('Comment cannot be empty');
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    }

    let depth = 0;
    if (parentId) {
      const parent = await this.drizzle.db.query.comments.findFirst({
        where: and(eq(comments.id, parentId), eq(comments.postId, postId)),
      });
      // The parent must live on this post: otherwise a reply could be grafted
      // onto an unrelated thread.
      if (!parent) throw new BadRequestException('Parent comment not found on this post');
      depth = Math.min(parent.depth + 1, MAX_COMMENT_DEPTH);
    }

    const [created] = await this.drizzle.db
      .insert(comments)
      .values({ postId, userId, content: body, parentId: parentId ?? null, depth })
      .returning();
    if (!created) throw new Error('Failed to create comment');

    await this.drizzle.db
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));

    const [authorRow] = await this.drizzle.db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const authorName = authorRow?.name || authorRow?.username || 'Someone';

    // Tell the parent author they were replied to; tell the post author about a
    // top-level comment. Both are fire-and-forget.
    if (parentId) {
      const parent = await this.drizzle.db.query.comments.findFirst({
        where: eq(comments.id, parentId),
        columns: { userId: true },
      });
      if (parent && String(parent.userId) !== String(userId)) {
        void this.notifications
          .notifyUser({
            tenantId,
            userId: parent.userId,
            type: 'comment',
            category: 'social',
            title: `${authorName} replied to your comment`,
            body: body.slice(0, 300),
            href: `/feed?post=${postId}&comment=${created.id}`,
            actorId: userId,
            entityType: 'comment',
            entityId: created.id,
            idempotencyKey: `reply:${tenantId}:${created.id}`,
          })
          .catch(() => {});
      }
    } else if (String(post.userId) !== String(userId)) {
      void this.notifications
        .notifyUser({
          tenantId,
          userId: post.userId,
          type: 'comment',
          category: 'social',
          title: `${authorName} commented on your post`,
          body: body.slice(0, 300),
          href: `/feed?post=${postId}&comment=${created.id}`,
          actorId: userId,
          entityType: 'comment',
          entityId: created.id,
          idempotencyKey: `comment:${tenantId}:${created.id}`,
        })
        .catch(() => {});
    }

    void this.notifyMentions(tenantId, userId, body, 'comment', created.id, `/feed?post=${postId}&comment=${created.id}`);

    // Return the author with the comment: a client that renders the new comment
    // straight from this response must not have to guess who wrote it.
    return this.presentComment(
      { ...created, user: authorRow ?? null, votes: [] } as never,
      userId,
    );
  }

  async voteComment(tenantId: string, commentId: string, userId: string, value: number) {
    if (![1, -1, 0].includes(value)) throw new BadRequestException('Vote must be 1, -1 or 0');

    const comment = await this.drizzle.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: { post: { columns: { tenantId: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.post?.tenantId && String(comment.post.tenantId) !== String(tenantId)) {
      throw new NotFoundException('Comment not found');
    }
    if (String(comment.userId) === String(userId)) {
      throw new ForbiddenException('You cannot vote on your own comment');
    }

    const previous = await this.drizzle.db.query.commentVotes.findFirst({
      where: and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)),
    });

    await this.drizzle.db.transaction(async (tx) => {
      if (value === 0) {
        if (previous) {
          await tx.delete(commentVotes).where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)));
        }
      } else {
        await tx
          .insert(commentVotes)
          .values({ commentId, userId, value })
          .onConflictDoUpdate({
            target: [commentVotes.commentId, commentVotes.userId],
            set: { value, createdAt: new Date() },
          });
      }
      await tx.execute(sql`
        update ${comments} c
        set score = agg.total
        from (
          select coalesce(sum(value), 0)::int as total
          from ${commentVotes}
          where ${commentVotes.commentId} = ${commentId}
        ) agg
        where c.id = ${commentId}
      `);
    });

    const [updated] = await this.drizzle.db.select({ score: comments.score }).from(comments).where(eq(comments.id, commentId));
    return { score: updated?.score ?? 0, myVote: value };
  }

  /**
   * Soft delete. The row stays so replies keep their position in the thread, but
   * the body is hidden and the author is not named.
   */
  async deleteComment(tenantId: string, commentId: string, userId: string, isModerator = false) {
    const comment = await this.drizzle.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: { post: { columns: { tenantId: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.post?.tenantId && String(comment.post.tenantId) !== String(tenantId)) {
      throw new NotFoundException('Comment not found');
    }
    if (!isModerator && String(comment.userId) !== String(userId)) {
      throw new ForbiddenException('Not your comment');
    }
    if (comment.isRemoved) return { removed: true, alreadyRemoved: true };

    await this.drizzle.db
      .update(comments)
      .set({ isRemoved: true, content: '', score: 0 })
      .where(eq(comments.id, commentId));
    await this.drizzle.db
      .update(posts)
      .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, comment.postId));

    return { removed: true };
  }

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  /** The tag index, most used first. Backs the feed's filter bar. */
  async getTags(tenantId: string, limit = 50) {
    const rows = await this.drizzle.db
      .select({
        id: tags.id,
        slug: tags.slug,
        label: tags.label,
        usageCount: tags.usageCount,
      })
      .from(tags)
      .where(eq(tags.tenantId, tenantId))
      .orderBy(desc(tags.usageCount), asc(tags.label))
      .limit(Math.min(Math.max(limit, 1), 200));
    return rows;
  }

  async getTag(tenantId: string, slug: string) {
    const normalized = this.normalizeTag(slug);
    const [row] = await this.drizzle.db
      .select()
      .from(tags)
      .where(and(eq(tags.tenantId, tenantId), eq(tags.slug, normalized)))
      .limit(1);
    if (!row) throw new NotFoundException('Tag not found');
    return row;
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async createPost(data: {
    userId: string;
    tenantId: string;
    content: string;
    mediaUrls?: string[];
    tags?: string[];
    isPublic?: boolean;
  }) {
    const tagSlugs = this.normalizeTagList(data.tags);
    const [post] = await this.drizzle.db
      .insert(posts)
      // `tags` (the array column) is left alone on purpose: it is legacy, and
      // the join table is what the application reads.
      .values({
        userId: data.userId,
        tenantId: data.tenantId,
        content: data.content,
        mediaUrls: data.mediaUrls ?? null,
        isPublic: data.isPublic ?? true,
      })
      .returning();
    if (!post) throw new Error('Failed to create post');

    if (tagSlugs.length) await this.attachTags(data.tenantId, post.id, tagSlugs);
    void this.search?.indexEntity(data.tenantId, 'post', post.id);
    void this.notifyMentions(data.tenantId, data.userId, data.content, 'post', post.id, `/feed?post=${post.id}`);

    // Read the tags back rather than echoing the slugs: the stored label is the
    // human-facing one ("5 Axis Machining"), and a made-up one would render wrong
    // until the next fetch.
    const attached = await this.drizzle.db
      .select({ id: tags.id, slug: tags.slug, label: tags.label })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id));

    const [author] = await this.drizzle.db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    return this.presentPost(
      {
        ...post,
        user: author ?? null,
        votes: [],
        postTags: attached.map((tag) => ({ tag })),
      } as never,
      data.userId,
    );
  }

  async deletePost(tenantId: string, postId: string, userId: string) {
    const post = await this.findPost(tenantId, postId);
    if (String(post.userId) !== String(userId)) throw new ForbiddenException('Not your post');
    // post_tags and post_likes cascade; comments cascade from the post.
    await this.drizzle.db.delete(posts).where(eq(posts.id, postId));
    if (post.tenantId) void this.search?.removeEntity(post.tenantId, 'post', postId);
    await this.refreshTagCounts(tenantId);
  }

  /** Create any missing tags, link them, and keep the usage counts honest. */
  private async attachTags(tenantId: string, postId: string, slugs: string[]) {
    for (const slug of slugs) {
      const [existing] = await this.drizzle.db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.slug, slug)))
        .limit(1);
      const tagId =
        existing?.id ??
        (
          await this.drizzle.db
            .insert(tags)
            .values({
              tenantId,
              slug,
              label: slug.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
            })
            .onConflictDoNothing({ target: [tags.tenantId, tags.slug] })
            .returning({ id: tags.id })
        )[0]?.id;
      if (!tagId) continue;
      await this.drizzle.db.insert(postTags).values({ postId, tagId }).onConflictDoNothing();
    }
    await this.refreshTagCounts(tenantId);
  }

  private async refreshTagCounts(tenantId: string) {
    await this.drizzle.db.execute(sql`
      update ${tags} t
      set usage_count = coalesce(agg.n, 0)
      from (
        select tg.id, count(pt."post_id")::int as n
        from ${tags} tg
        left join ${postTags} pt on pt."tag_id" = tg.id
        where tg."tenant_id" = ${tenantId}
        group by tg.id
      ) agg
      where t.id = agg.id and t."tenant_id" = ${tenantId}
    `);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Tenant-scoped post lookup. Every read and write goes through here. */
  private async findPost(tenantId: string, postId: string) {
    const [post] = await this.drizzle.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.tenantId, tenantId)))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private presentPost(
    post: {
      id: string;
      content: string;
      mediaUrls: string[] | null;
      isPublic: boolean | null;
      score: number;
      likeCount: number;
      downvoteCount: number;
      commentCount: number;
      createdAt: Date;
      userId: string;
      user?: { id: string; name: string | null; username: string | null; avatarUrl: string | null; headline: string | null; role: string | null } | null;
      votes?: Array<{ userId: string; value: number }>;
      postTags?: Array<{ tag: { slug: string; label: string } }>;
    },
    currentUserId?: string,
  ) {
    const my = post.votes?.find((vote) => String(vote.userId) === String(currentUserId ?? ''));
    return {
      id: post.id,
      content: post.content,
      mediaUrls: post.mediaUrls,
      isPublic: post.isPublic ?? true,
      userId: post.userId,
      createdAt: post.createdAt,
      score: post.score,
      upvotes: post.likeCount,
      downvotes: post.downvoteCount,
      voteCount: post.likeCount + post.downvoteCount,
      commentCount: post.commentCount,
      myVote: my?.value ?? 0,
      // The UI has always read `author`; the API used to send `user`, so the name
      // rendered as "Unknown" and the profile link pointed at `/profile/`.
      author: post.user
        ? {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
            headline: post.user.headline,
            role: post.user.role,
          }
        : null,
      tags: (post.postTags ?? []).map((entry) => entry.tag),
    };
  }

  private presentComment(
    comment: {
      id: string;
      content: string;
      userId: string;
      parentId: string | null;
      depth: number;
      score: number;
      isRemoved: boolean;
      createdAt: Date;
      editedAt: Date | null;
      user?: { id: string; name: string | null; username: string | null; avatarUrl: string | null; headline: string | null; role: string | null } | null;
      votes?: Array<{ userId: string; value: number }>;
    },
    currentUserId?: string,
  ) {
    const my = comment.votes?.find((vote) => String(vote.userId) === String(currentUserId ?? ''));
    const removed = comment.isRemoved;
    return {
      id: comment.id,
      postId: (comment as { postId?: string }).postId,
      parentId: comment.parentId,
      depth: comment.depth,
      score: removed ? 0 : comment.score,
      myVote: my?.value ?? 0,
      isRemoved: removed,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      userId: comment.userId,
      // A removed comment keeps its slot but gives away nothing: no body, no name.
      content: removed ? '' : comment.content,
      author: removed
        ? null
        : comment.user
          ? {
              id: comment.user.id,
              name: comment.user.name,
              username: comment.user.username,
              avatarUrl: comment.user.avatarUrl,
              headline: comment.user.headline,
              role: comment.user.role,
            }
          : null,
    };
  }

  /** Lowercase, hyphenated, bounded. One tag has exactly one canonical form. */
  private normalizeTag(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, MAX_TAG_LENGTH);
  }

  private normalizeTagList(values?: string[]): string[] {
    if (!Array.isArray(values)) return [];
    const out: string[] = [];
    for (const value of values.slice(0, MAX_TAGS_PER_POST * 2)) {
      const slug = this.normalizeTag(String(value));
      if (slug && !out.includes(slug)) out.push(slug);
      if (out.length >= MAX_TAGS_PER_POST) break;
    }
    return out;
  }

  private async notifyMentions(
    tenantId: string,
    actorId: string,
    content: string,
    entityType: string,
    entityId: string,
    href: string,
  ): Promise<void> {
    const handles = [...content.matchAll(/@([a-zA-Z0-9_]{3,30})/g)].map((match) => match[1]!.toLowerCase());
    if (handles.length === 0) return;
    const mentioned = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.username, handles), eq(users.tenantId, tenantId)));
    for (const user of mentioned) {
      if (String(user.id) === String(actorId)) continue;
      void this.notifications
        .notifyUser({
          tenantId,
          userId: user.id,
          type: 'mention',
          category: 'social',
          title: 'You were mentioned',
          body: content.slice(0, 200),
          href,
          actorId,
          entityType,
          entityId,
          idempotencyKey: `mention:${tenantId}:${entityType}:${entityId}:${user.id}`,
        })
        .catch(() => {});
    }
  }
}
