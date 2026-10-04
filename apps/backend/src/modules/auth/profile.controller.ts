import {
  Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus,
  UseGuards, Query, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DrizzleService } from '../../database/drizzle.service';
import { users, follows, userPortfolioItems } from '../../database/schema/users';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { AuthService } from './services/auth.service';
import { UploadService } from './services/upload.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('profile')
@Controller()
export class ProfileController {
  constructor(
    private auth: AuthService,
    private upload: UploadService,
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
  ) {}

  @Public()
  @Get('profile/:username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public profile by username' })
  async getPublicProfile(@Param('username') username: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.username, username),
      with: {
        portfolioItems: { orderBy: [asc(userPortfolioItems.sortOrder)] },
        tenant: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    const [followersCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, user.id));
    const [followingCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, user.id));
    const [enrollmentsCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sql`enrollments`)
      .where(eq(sql`enrollments.user_id`, user.id));
    const [certificationsCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sql`certifications`)
      .where(eq(sql`certifications.user_id`, user.id));
    const [postsCount] = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sql`posts`)
      .where(eq(sql`posts.user_id`, user.id));

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      headline: user.headline,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      location: user.location,
      portfolioEnabled: user.portfolioEnabled,
      portfolioItems: user.portfolioItems || [],
      stats: {
        followers: followersCount?.count || 0,
        following: followingCount?.count || 0,
        enrollments: enrollmentsCount?.count || 0,
        certifications: certificationsCount?.count || 0,
        posts: postsCount?.count || 0,
      },
      createdAt: user.createdAt,
    };
  }

  @UseGuards(OptionalAuthGuard)
  @Get('profile/:username/follow-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if current user follows this profile' })
  async getFollowStatus(
    @Param('username') username: string,
    @CurrentUser() currentUser: any,
  ) {
    if (!currentUser?.id) return { isFollowing: false };
    const target = await this.drizzle.db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (!target) throw new BadRequestException('User not found');
    const follow = await this.drizzle.db.query.follows.findFirst({
      where: and(eq(follows.followerId, currentUser.id), eq(follows.followingId, target.id)),
    });
    return { isFollowing: !!follow };
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/:userId/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle follow/unfollow a user' })
  @ApiBearerAuth()
  async toggleFollow(
    @Param('userId') targetUserId: string,
    @CurrentUser() currentUser: any,
  ) {
    // Following yourself is never a valid state, on any route.
    if (String(currentUser.id) === String(targetUserId)) {
      throw new ConflictException('Cannot follow yourself');
    }

    const target = await this.drizzle.db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.tenantId, currentUser.tenantId)),
      columns: { id: true, username: true, name: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.drizzle.db.query.follows.findFirst({
      where: and(eq(follows.followerId, currentUser.id), eq(follows.followingId, targetUserId)),
    });

    if (existing) {
      await this.drizzle.db.delete(follows)
        .where(and(eq(follows.followerId, currentUser.id), eq(follows.followingId, targetUserId)));
      await this.auth.audit.log({ userId: currentUser.id, action: 'user.unfollow', entityType: 'user', entityId: targetUserId });
      return { following: false };
    }

    // `onConflictDoNothing` is required now that `follows` carries a unique
    // index: a plain insert would raise 23505 on a duplicate edge.
    const inserted = await this.drizzle.db
      .insert(follows)
      .values({ followerId: currentUser.id, followingId: targetUserId })
      .onConflictDoNothing({ target: [follows.followerId, follows.followingId] })
      .returning({ followerId: follows.followerId });

    if (inserted.length === 0) return { following: true };

    await this.auth.audit.log({ userId: currentUser.id, action: 'user.follow', entityType: 'user', entityId: targetUserId });
    void this.notifications.notifyUser({
      tenantId: currentUser.tenantId,
      userId: target.id,
      type: 'follow',
      category: 'social',
      title: `${currentUser.name || 'Someone'} started following you`,
      body: 'You have a new follower.',
      href: target.username ? `/u/${target.username}` : `/profile/${target.id}`,
      actorId: currentUser.id,
      entityType: 'user',
      entityId: target.id,
      idempotencyKey: `follow:${currentUser.tenantId}:${currentUser.id}:${target.id}`,
    }).catch(() => {});
    return { following: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:userId/followers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get followers of a user' })
  @ApiBearerAuth()
  async getFollowers(
    @Param('userId') userId: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const rows = await this.drizzle.db.query.follows.findMany({
      where: eq(follows.followingId, userId),
      with: { follower: true },
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: [desc(follows.createdAt)],
    });
    return rows.map((r: any) => ({
      id: r.follower.id,
      username: r.follower.username,
      name: r.follower.name,
      avatarUrl: r.follower.avatarUrl,
      headline: r.follower.headline,
      followedAt: r.createdAt,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:userId/following')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get users that a user follows' })
  @ApiBearerAuth()
  async getFollowing(
    @Param('userId') userId: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const rows = await this.drizzle.db.query.follows.findMany({
      where: eq(follows.followerId, userId),
      with: { following: true },
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: [desc(follows.createdAt)],
    });
    return rows.map((r: any) => ({
      id: r.following.id,
      username: r.following.username,
      name: r.following.name,
      avatarUrl: r.following.avatarUrl,
      headline: r.following.headline,
      followedAt: r.createdAt,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('portfolio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user portfolio items' })
  @ApiBearerAuth()
  async getMyPortfolio(@CurrentUser() user: any) {
    return this.drizzle.db.query.userPortfolioItems.findMany({
      where: eq(userPortfolioItems.userId, user.id),
      orderBy: [asc(userPortfolioItems.sortOrder)],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('portfolio')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a portfolio item' })
  @ApiBearerAuth()
  async createPortfolioItem(
    @CurrentUser() user: any,
    @Body() body: { title: string; description?: string; image?: string; projectUrl?: string; tags?: string[] },
  ) {
    if (!body.title?.trim()) throw new BadRequestException('Title is required');

    let imageUrl: string | null = null;
    if (body.image) {
      imageUrl = await this.upload.savePortfolioImage(user.id, body.image);
    }

    const maxSort = await this.drizzle.db
      .select({ max: sql<number>`max(${userPortfolioItems.sortOrder})` })
      .from(userPortfolioItems)
      .where(eq(userPortfolioItems.userId, user.id));

    const [itemCreated] = await this.drizzle.db.insert(userPortfolioItems).values({
      userId: user.id,
      title: body.title,
      description: body.description || null,
      imageUrl,
      projectUrl: body.projectUrl || null,
      tags: body.tags || [],
      sortOrder: (maxSort?.[0]?.max ?? -1) + 1,
    }).returning();

    if (!itemCreated) throw new BadRequestException('Failed to create portfolio item');
    await this.auth.audit.log({ userId: user.id, action: 'portfolio.create', entityType: 'portfolio_item', entityId: itemCreated.id });
    return itemCreated;
  }

  @UseGuards(JwtAuthGuard)
  @Put('portfolio/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a portfolio item' })
  @ApiBearerAuth()
  async updatePortfolioItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; image?: string; projectUrl?: string; tags?: string[]; sortOrder?: number },
  ) {
    const item = await this.drizzle.db.query.userPortfolioItems.findFirst({
      where: and(eq(userPortfolioItems.id, id), eq(userPortfolioItems.userId, user.id)),
    });
    if (!item) throw new BadRequestException('Portfolio item not found');

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.projectUrl !== undefined) updateData.projectUrl = body.projectUrl;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.image) {
      if (item.imageUrl) await this.upload.deleteFile(item.imageUrl);
      updateData.imageUrl = await this.upload.savePortfolioImage(user.id, body.image);
    }
    updateData.updatedAt = new Date();

    const [updated] = await this.drizzle.db.update(userPortfolioItems)
      .set(updateData)
      .where(eq(userPortfolioItems.id, id))
      .returning();

    await this.auth.audit.log({ userId: user.id, action: 'portfolio.update', entityType: 'portfolio_item', entityId: id });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('portfolio/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a portfolio item' })
  @ApiBearerAuth()
  async deletePortfolioItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const item = await this.drizzle.db.query.userPortfolioItems.findFirst({
      where: and(eq(userPortfolioItems.id, id), eq(userPortfolioItems.userId, user.id)),
    });
    if (!item) throw new BadRequestException('Portfolio item not found');

    if (item.imageUrl) await this.upload.deleteFile(item.imageUrl);
    await this.drizzle.db.delete(userPortfolioItems).where(eq(userPortfolioItems.id, id));
    await this.auth.audit.log({ userId: user.id, action: 'portfolio.delete', entityType: 'portfolio_item', entityId: id });
    return { message: 'Portfolio item deleted' };
  }

  @UseGuards(JwtAuthGuard)
  @Put('portfolio/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder portfolio items' })
  @ApiBearerAuth()
  async reorderPortfolio(
    @CurrentUser() user: any,
    @Body() body: { items: { id: string; sortOrder: number }[] },
  ) {
    for (const item of body.items) {
      await this.drizzle.db.update(userPortfolioItems)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(and(eq(userPortfolioItems.id, item.id), eq(userPortfolioItems.userId, user.id)));
    }
    return { message: 'Portfolio reordered' };
  }
}
