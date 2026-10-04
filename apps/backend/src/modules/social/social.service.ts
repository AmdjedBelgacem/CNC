import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users, follows, userPortfolioItems } from '../../database/schema/users';
import { posts, postVotes, comments } from '../../database/schema/posts';
import { enrollments, lessonProgress, lessonQuizAttempts } from '../../database/schema/progress';
import { certifications } from '../../database/schema/certifications';
import { userPreferences } from '../../database/schema/user-preferences';
import { userBlocks } from '../../database/schema/dm';
import { series, lessons } from '../../database/schema/courses';
import { eq, and, desc, asc, count, ilike, or, inArray, isNull, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';

/** Roles worth surfacing publicly; a plain `student`/`learner` is noise. */
const PUBLIC_ROLES = new Set(['instructor', 'admin', 'super_admin', 'moderator', 'sponsor']);

/** Account states that still get a public profile. */
const PUBLIC_STATUSES = new Set(['active', 'pending_verification']);

const isPubliclyVisible = (status: string | null | undefined, deletedAt?: Date | null) =>
  !!status && PUBLIC_STATUSES.has(status) && !deletedAt;

/** Columns safe to return on a public profile — never secrets. */
const PUBLIC_PROFILE_COLUMNS = {
  id: true,
  username: true,
  name: true,
  headline: true,
  bio: true,
  avatarUrl: true,
  coverImageUrl: true,
  location: true,
  portfolioEnabled: true,
  language: true,
  timezone: true,
  role: true,
  accountStatus: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  metadata: true,
} as const;

export interface ProfileCoursesResult {
  enrollments: {
    id: string;
    courseId: string;
    status: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    certificateId: string | null;
    progressPercent: number;
    completedLessons: number;
    totalLessons: number;
    watchTimeSeconds: number;
    course: {
      id: string;
      slug: string;
      title: string;
      subtitle: string | null;
      thumbnailUrl: string | null;
      difficulty: number | null;
      estimatedHours: number | null;
      trailerUrl: string | null;
    } | null;
  }[];
  certificates: {
    id: string;
    certificateNumber: string;
    courseId: string;
    issuedAt: Date;
    expiresAt: Date | null;
    pdfUrl: string | null;
    revokedAt: Date | null;
    course: { id: string; slug: string; title: string } | null;
  }[];
}

@Injectable()
export class SocialService {
  constructor(
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
    private search?: SearchService,
  ) {}

  /**
   * Public profile. Returns identity, aggregate stats and the portfolio.
   * `viewerId` only affects `isFollowing` / `isSelf`; it never widents access.
   */
  async getProfile(tenantId: string, userId: string, viewerId?: string) {
    const profile = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
      columns: PUBLIC_PROFILE_COLUMNS,
    });
    if (!profile) throw new NotFoundException('User not found');

    // A suspended/locked/soft-deleted account is not a public persona.
    if (!isPubliclyVisible(profile.accountStatus)) throw new NotFoundException('User not found');

    const preferences = await this.drizzle.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
      columns: { profileVisibility: true, whoCanFollow: true },
    });
    const isSelf = viewerId != null && String(viewerId) === String(userId);
    const isFollowing = viewerId
      ? !!(await this.drizzle.db.query.follows.findFirst({
          where: and(eq(follows.followerId, viewerId), eq(follows.followingId, userId)),
          columns: { followerId: true },
        }))
      : false;

    // A private profile still resolves (so the owner can preview it) but the
    // viewer only sees the identity card.
    const isPrivate = (preferences?.profileVisibility ?? 'public') !== 'public';
    if (isPrivate && !isSelf) {
      return {
        ...this.toPublicProfile(profile),
        isPrivate: true,
        isSelf,
        isFollowing,
        canFollow: false,
        stats: { followers: 0, following: 0, posts: 0, likes: 0, comments: 0 },
        learning: { enrollments: 0, completed: 0, certificates: 0, lessonsCompleted: 0, watchTimeSeconds: 0, quizAttempts: 0 },
        portfolioItems: [],
      };
    }

    const [followerCount, followingCount, postCount, likeCount, commentCount] = await Promise.all([
      this.countWhere(follows, follows.followingId, userId),
      this.countWhere(follows, follows.followerId, userId),
      // Only public posts are counted — a private post must not leak by count.
      this.db().select({ count: count() }).from(posts)
        .where(and(eq(posts.userId, userId), eq(posts.isPublic, true)))
        .then(([row]) => row?.count ?? 0),
      this.db().select({ count: count() })
        .from(postVotes)
        .innerJoin(posts, eq(postVotes.postId, posts.id))
        .where(and(eq(posts.userId, userId), eq(posts.isPublic, true)))
        .then(([row]) => row?.count ?? 0),
      this.db().select({ count: count() })
        .from(comments)
        .innerJoin(posts, eq(comments.postId, posts.id))
        .where(and(eq(posts.userId, userId), eq(posts.isPublic, true)))
        .then(([row]) => row?.count ?? 0),
    ]);

    const [enrollmentAgg] = await this.db()
      .select({
        enrollments: count(),
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')`,
      })
      .from(enrollments)
      .where(eq(enrollments.userId, userId));

    const [progressAgg] = await this.db()
      .select({
        lessonsCompleted: sql<number>`count(*) filter (where ${lessonProgress.completed} = true)`,
        watchTimeSeconds: sql<number>`coalesce(sum(${lessonProgress.watchTimeSeconds}), 0)`,
      })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId));

    const [certificateAgg] = await this.db()
      .select({ count: count() })
      .from(certifications)
      .where(and(eq(certifications.userId, userId), isNull(certifications.revokedAt)));

    const [quizAgg] = await this.db()
      .select({ attempts: count() })
      .from(lessonQuizAttempts)
      .where(eq(lessonQuizAttempts.userId, userId));

    const portfolioItems = profile.portfolioEnabled
      ? await this.drizzle.db.query.userPortfolioItems.findMany({
          where: eq(userPortfolioItems.userId, userId),
          orderBy: [asc(userPortfolioItems.sortOrder), desc(userPortfolioItems.createdAt)],
        })
      : [];

    return {
      ...this.toPublicProfile(profile),
      isPrivate,
      isSelf,
      isFollowing,
      canFollow: !isSelf && (preferences?.whoCanFollow ?? 'everyone') === 'everyone',
      stats: {
        followers: followerCount,
        following: followingCount,
        posts: postCount,
        likes: likeCount,
        comments: commentCount,
      },
      learning: {
        enrollments: enrollmentAgg?.enrollments ?? 0,
        completed: Number(enrollmentAgg?.completed ?? 0),
        certificates: certificateAgg?.count ?? 0,
        lessonsCompleted: Number(progressAgg?.lessonsCompleted ?? 0),
        watchTimeSeconds: Number(progressAgg?.watchTimeSeconds ?? 0),
        quizAttempts: quizAgg?.attempts ?? 0,
      },
      portfolioItems,
    };
  }

  /** Public posts by a user, newest first. */
  async getProfilePosts(tenantId: string, userId: string, page = 1, limit = 10) {
    await this.assertVisible(tenantId, userId);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);

    const data = await this.drizzle.db.query.posts.findMany({
      // Tenant-scoped: `assertVisible` proves the profile exists here, but the
      // posts themselves must also belong to this tenant.
      where: and(eq(posts.userId, userId), eq(posts.isPublic, true), eq(posts.tenantId, tenantId)),
      orderBy: desc(posts.createdAt),
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      with: {
        // The feed cards render the author, so the row has to carry it.
        user: { columns: { id: true, username: true, name: true, avatarUrl: true, headline: true, role: true } },
        votes: { columns: { userId: true, value: true } },
        postTags: { with: { tag: { columns: { id: true, slug: true, label: true } } } },
      },
    });
    const [total] = await this.db().select({ count: count() }).from(posts)
      .where(and(eq(posts.userId, userId), eq(posts.isPublic, true), eq(posts.tenantId, tenantId)));

    // Same shape as the feed, so one PostCard renders both.
    return {
      data: data.map((post) => ({
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
        myVote: 0,
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
        tags: post.postTags.map((entry) => entry.tag),
      })),
      total: total?.count ?? 0,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * The public learning record: enrollments with per-course progress plus the
   * certificates earned. Progress is derived from `lesson_progress` because
   * `enrollments` carries no percentage column, and the chain is
   * course -> series -> lessons.
   */
  async getProfileCourses(tenantId: string, userId: string): Promise<ProfileCoursesResult> {
    await this.assertVisible(tenantId, userId);

    const enrollmentRows = await this.drizzle.db.query.enrollments.findMany({
      where: eq(enrollments.userId, userId),
      orderBy: desc(enrollments.startedAt),
      with: {
        course: {
          columns: {
            id: true, slug: true, title: true, subtitle: true,
            thumbnailUrl: true, difficulty: true, estimatedHours: true, trailerUrl: true,
          },
        },
      },
    });

    const courseIds = enrollmentRows.map((row) => row.courseId);

    // courseId -> lesson ids, so a percentage means something.
    const lessonsByCourse = new Map<string, string[]>();
    let watchTimeByCourse = new Map<string, number>();
    let completedByCourse = new Map<string, number>();

    if (courseIds.length > 0) {
      const seriesRows = await this.drizzle.db.query.series.findMany({
        where: inArray(series.courseId, courseIds),
        columns: { id: true, courseId: true },
      });
      const seriesByCourse = new Map<string, string[]>();
      for (const row of seriesRows) {
        seriesByCourse.set(row.courseId, [...(seriesByCourse.get(row.courseId) ?? []), row.id]);
      }
      const seriesIds = seriesRows.map((row) => row.id);

      if (seriesIds.length > 0) {
        const lessonRows = await this.drizzle.db.query.lessons.findMany({
          where: inArray(lessons.seriesId, seriesIds),
          columns: { id: true, seriesId: true },
        });
        const seriesToCourse = new Map(seriesRows.map((row) => [row.id, row.courseId]));
        for (const lesson of lessonRows) {
          const courseId = seriesToCourse.get(lesson.seriesId);
          if (courseId) lessonsByCourse.set(courseId, [...(lessonsByCourse.get(courseId) ?? []), lesson.id]);
        }

        const progressRows = await this.drizzle.db.query.lessonProgress.findMany({
          where: and(
            eq(lessonProgress.userId, userId),
            inArray(lessonProgress.lessonId, lessonRows.map((lesson) => lesson.id)),
          ),
          columns: { lessonId: true, completed: true, watchTimeSeconds: true },
        });
        const courseByLesson = new Map<string, string>();
        for (const lesson of lessonRows) {
          const courseId = seriesToCourse.get(lesson.seriesId);
          if (courseId) courseByLesson.set(lesson.id, courseId);
        }

        watchTimeByCourse = new Map();
        completedByCourse = new Map();
        for (const progress of progressRows) {
          const courseId = courseByLesson.get(progress.lessonId);
          if (!courseId) continue;
          if (progress.completed) {
            completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
          }
          watchTimeByCourse.set(
            courseId,
            (watchTimeByCourse.get(courseId) ?? 0) + (progress.watchTimeSeconds ?? 0),
          );
        }
      }
    }

    const certificateRows = await this.drizzle.db.query.certifications.findMany({
      where: eq(certifications.userId, userId),
      orderBy: desc(certifications.issuedAt),
      with: { course: { columns: { id: true, slug: true, title: true } } },
    });

    return {
      enrollments: enrollmentRows.map((row) => {
        const totalLessons = lessonsByCourse.get(row.courseId)?.length ?? 0;
        const completedLessons = completedByCourse.get(row.courseId) ?? 0;
        const isCompleted = row.status === 'completed';
        const progressPercent = isCompleted
          ? 100
          : totalLessons > 0
            ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
            : 0;
        const course = row.course as Record<string, unknown> | null;
        return {
          id: row.id,
          courseId: row.courseId,
          status: row.status ?? null,
          startedAt: row.startedAt ?? null,
          completedAt: row.completedAt ?? null,
          certificateId: row.certificateId ?? null,
          progressPercent,
          completedLessons,
          totalLessons,
          watchTimeSeconds: watchTimeByCourse.get(row.courseId) ?? 0,
          course: course
            ? {
                id: course.id as string,
                slug: course.slug as string,
                title: course.title as string,
                subtitle: (course.subtitle as string | null) ?? null,
                thumbnailUrl: (course.thumbnailUrl as string | null) ?? null,
                difficulty: (course.difficulty as number | null) ?? null,
                estimatedHours: (course.estimatedHours as number | null) ?? null,
                trailerUrl: (course.trailerUrl as string | null) ?? null,
              }
            : null,
        };
      }),
      certificates: certificateRows.map((row) => ({
        id: row.id,
        certificateNumber: row.certificateNumber,
        courseId: row.courseId,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt ?? null,
        pdfUrl: row.pdfUrl ?? null,
        revokedAt: row.revokedAt ?? null,
        course: row.course ? { id: row.course.id, slug: row.course.slug, title: row.course.title } : null,
      })),
    };
  }

  /** Public followers / following lists. */
  async getConnections(tenantId: string, userId: string, kind: 'followers' | 'following', limit = 24, offset = 0) {
    await this.assertVisible(tenantId, userId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    // The person on the other side of the edge.
    const otherId = kind === 'followers' ? follows.followerId : follows.followingId;
    // Column that points at the profile being viewed.
    const ownerId = kind === 'followers' ? follows.followingId : follows.followerId;

    const rows = await this.db()
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(users.id, otherId))
      .where(and(eq(ownerId, userId), eq(users.tenantId, tenantId)))
      .orderBy(desc(follows.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);

    const total = await (kind === 'followers'
      ? this.countWhere(follows, follows.followingId, userId)
      : this.countWhere(follows, follows.followerId, userId));

    return { data: rows, total, limit: safeLimit, offset: safeOffset };
  }

  async updateProfile(userId: string, tenantId: string, data: { name?: string; headline?: string; bio?: string; avatarUrl?: string; location?: string }) {
    await this.drizzle.db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));

    // Re-read through the public column allowlist: `returning()` would hand back
    // the raw row including `passwordHash` and lockout state.
    const [user] = await this.drizzle.db.query.users.findMany({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
      columns: PUBLIC_PROFILE_COLUMNS,
      limit: 1,
    });
    if (!user) throw new NotFoundException('User not found');
    void this.search?.indexEntity(tenantId, 'user', userId);
    return this.toPublicProfile(user);
  }

  /**
   * Idempotent follow. Following someone you already follow is a success, not
   * a 409: the button can be double-clicked and a retry after a timeout should
   * not surface an error. `onConflictDoNothing` leans on the unique index, so
   * concurrent follows cannot create duplicate edges.
   */
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ConflictException('Cannot follow yourself');

    const [followingUser] = await this.drizzle.db
      .select({ id: users.id, tenantId: users.tenantId, name: users.name, accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.id, followingId))
      .limit(1);
    if (!followingUser || !isPubliclyVisible(followingUser.accountStatus)) {
      throw new ConflictException('User not found');
    }
    const [follower] = await this.drizzle.db
      .select({ id: users.id, tenantId: users.tenantId, name: users.name })
      .from(users)
      .where(eq(users.id, followerId))
      .limit(1);
    if (!follower || String(follower.tenantId) !== String(followingUser.tenantId)) {
      throw new ConflictException('Cross-tenant follow is not allowed');
    }
    if (await this.isBlockedEitherWay(followerId, followingId)) {
      throw new ConflictException('Follow is not available');
    }

    // Honour the target's "who can follow me" preference.
    const preferences = await this.drizzle.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, followingId),
      columns: { whoCanFollow: true },
    });
    if ((preferences?.whoCanFollow ?? 'everyone') !== 'everyone') {
      throw new ConflictException('This member does not accept new followers');
    }

    const inserted = await this.drizzle.db
      .insert(follows)
      .values({ followerId, followingId })
      .onConflictDoNothing({ target: [follows.followerId, follows.followingId] })
      .returning({ followerId: follows.followerId });

    // Only notify on a genuinely new edge.
    if (inserted.length > 0) {
      void this.notifications.notifyUser({
        tenantId: followingUser.tenantId,
        userId: followingId,
        type: 'follow',
        category: 'social',
        title: `${follower.name ?? 'Someone'} started following you`,
        body: 'You have a new follower.',
        href: `/u/${followerId}`,
        actorId: followerId,
        entityType: 'user',
        entityId: followingId,
        idempotencyKey: `follow:${followingUser.tenantId}:${followerId}:${followingId}`,
      }).catch(() => {});
    }

    return { following: true, created: inserted.length > 0 };
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
        inArray(users.accountStatus, Array.from(PUBLIC_STATUSES)),
        isNull(users.deletedAt),
        or(ilike(users.name, `%${query}%`), ilike(users.headline, `%${query}%`), ilike(users.bio, `%${query}%`)),
      ),
      columns: { id: true, username: true, name: true, avatarUrl: true, headline: true },
      limit: 20,
    });
  }

  /** Whether the viewer follows this user. */
  async getFollowStatus(viewerId: string | undefined, targetId: string) {
    if (!viewerId) return { isFollowing: false, isSelf: false };
    if (viewerId === targetId) return { isFollowing: false, isSelf: true };
    const edge = await this.drizzle.db.query.follows.findFirst({
      where: and(eq(follows.followerId, viewerId), eq(follows.followingId, targetId)),
      columns: { followerId: true },
    });
    return { isFollowing: !!edge, isSelf: false };
  }

  /**
   * Follow state for a whole list of people in one query, so a people list can
   * render Follow/Following without N round-trips.
   */
  async getFollowStatuses(viewerId: string, targetIds: string[]) {
    const ids = [...new Set(targetIds)].filter((id) => id && id !== viewerId).slice(0, 200);
    if (ids.length === 0) return {} as Record<string, boolean>;
    const rows = await this.db()
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, ids)));
    const following = new Set(rows.map((row) => row.followingId));
    return Object.fromEntries(ids.map((id) => [id, following.has(id)]));
  }

  /**
   * People worth following: active members of the same tenant that the viewer
   * does not follow yet, ranked by how many people the viewer already follows
   * also follow them (a follower-of-a-follower signal), then by activity.
   */
  async getSuggestions(tenantId: string, viewerId: string, limit = 6) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const [viewerRow] = await this.drizzle.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, viewerId))
      .limit(1);
    if (!viewerRow || String(viewerRow.tenantId) !== String(tenantId)) return [];

    const alreadyFollowing = await this.db()
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    // The viewer plus everyone they already follow.
    const excluded = [
      viewerId,
      ...alreadyFollowing.map((row) => row.followingId),
    ];

    const candidates = await this.db()
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        lastLoginAt: users.lastLoginAt,
        // Accounts both the viewer and this candidate follow. It is a cheap,
        // honest connection signal ("you both follow the same people") that
        // needs one correlated subquery instead of a graph traversal.
        mutual: sql<number>`(
          select count(*) from ${follows} mine
          join ${follows} theirs
            on theirs.follower_id = ${users.id}
           and theirs.following_id = mine.following_id
          where mine.follower_id = ${viewerId}
            and mine.following_id <> ${viewerId}
        )`,
      })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        inArray(users.accountStatus, Array.from(PUBLIC_STATUSES)),
        isNull(users.deletedAt),
        sql`${users.id} not in ${excluded}`,
      ))
      .orderBy(sql`${users.lastLoginAt} desc nulls last`)
      .limit(safeLimit * 4);

    const excludedSet = new Set(excluded);
    const ranked = candidates
      .filter((row) => !excludedSet.has(row.id))
      .sort((a, b) => {
        if (b.mutual !== a.mutual) return b.mutual - a.mutual;
        const aActive = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bActive = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return bActive - aActive;
      })
      .slice(0, safeLimit);

    const followerCountRows = ranked.length
      ? await this.db()
          .select({ followingId: follows.followingId, count: count() })
          .from(follows)
          .where(inArray(follows.followingId, ranked.map((row) => row.id)))
          .groupBy(follows.followingId)
      : [];
    const followerCountById = new Map(followerCountRows.map((row) => [row.followingId, row.count]));

    return ranked.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      avatarUrl: row.avatarUrl,
      headline: row.headline,
      followerCount: followerCountById.get(row.id) ?? 0,
      mutualCount: Number(row.mutual ?? 0),
      isFollowing: false,
    }));
  }

  /** A block in either direction makes a follow impossible. */
  private async isBlockedEitherWay(aId: string, bId: string) {
    try {
      const blocks = await this.drizzle.db.query.userBlocks?.findFirst?.({
        where: or(
          and(eq(userBlocks.blockerId, aId), eq(userBlocks.blockedId, bId)),
          and(eq(userBlocks.blockerId, bId), eq(userBlocks.blockedId, aId)),
        ),
        columns: { blockerId: true },
      });
      return !!blocks;
    } catch {
      // The blocks table is optional; never let it break following.
      return false;
    }
  }

  private db() {
    return this.drizzle.db;
  }

  private async countWhere(table: PgTable, column: PgColumn, value: string): Promise<number> {
    const [row] = await this.db().select({ count: count() }).from(table).where(eq(column, value));
    return row?.count ?? 0;
  }

  private async assertVisible(tenantId: string, userId: string) {
    const row = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
      columns: { id: true, accountStatus: true, deletedAt: true },
    });
    if (!row || !isPubliclyVisible(row.accountStatus, row.deletedAt)) {
      throw new NotFoundException('User not found');
    }
  }

  /** Shapes the row for the wire: role is only meaningful when it is elevated. */
  private toPublicProfile(profile: {
    id: string; username: string | null; name: string | null; headline: string | null;
    bio: string | null; avatarUrl: string | null; coverImageUrl: string | null;
    location: string | null; portfolioEnabled: boolean | null; language: string | null;
    timezone: string | null; role: string; accountStatus: string; emailVerifiedAt: Date | null;
    createdAt: Date; updatedAt: Date; lastLoginAt: Date | null; metadata: unknown;
  }) {
    const metadata = (profile.metadata ?? {}) as Record<string, unknown>;
    return {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      headline: profile.headline,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverImageUrl: profile.coverImageUrl,
      location: profile.location,
      portfolioEnabled: profile.portfolioEnabled ?? true,
      language: profile.language,
      timezone: profile.timezone,
      accountStatus: profile.accountStatus,
      isVerified: !!profile.emailVerifiedAt,
      verifiedAt: profile.emailVerifiedAt,
      // A plain `student` is the default, not a credential.
      role: PUBLIC_ROLES.has(profile.role) ? profile.role : null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      lastLoginAt: profile.lastLoginAt,
      links: {
        website: (metadata.website as string) ?? null,
        github: (metadata.github as string) ?? null,
        linkedin: (metadata.linkedin as string) ?? null,
      },
      company: (metadata.company as string) ?? null,
      skills: Array.isArray(metadata.skills) ? (metadata.skills as string[]) : [],
    };
  }
}
