import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedService, type CommentSort, type FeedSort } from './feed.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private feed: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get the public social feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['hot', 'new', 'top'] })
  @ApiQuery({ name: 'tag', required: false })
  getFeed(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('tag') tag?: string,
  ) {
    return this.feed.getFeed(tenant.id, page ? +page : 1, limit ? +limit : 20, user?.id, {
      sort: (sort as FeedSort) ?? 'hot',
      tag,
    });
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Posts from people I follow' })
  myFeed(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feed.getUserFeed(user.id, page ? +page : 1, limit ? +limit : 20, tenant.id, user.id);
  }

  // --- tags must be declared before ':postId' or they are captured by it ---

  @Get('tags')
  @ApiOperation({ summary: 'Tag index for this tenant, most used first' })
  @ApiQuery({ name: 'limit', required: false })
  async listTags(@CurrentTenant() tenant: { id: string }, @Query('limit') limit?: string) {
    return { data: await this.feed.getTags(tenant.id, limit ? +limit : 50) };
  }

  @Get('tags/:slug')
  @ApiOperation({ summary: 'One tag with its post feed' })
  async getTag(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    const tag = await this.feed.getTag(tenant.id, slug);
    const feed = await this.feed.getFeed(tenant.id, page ? +page : 1, limit ? +limit : 20, user?.id, {
      sort: (sort as FeedSort) ?? 'hot',
      tag: tag.slug,
    });
    return { data: { ...tag, feed } };
  }

  @Get('comments/:commentId')
  @ApiOperation({ summary: 'Not used directly; kept for parity with the comment routes' })
  getComment() {
    return { data: null };
  }

  @Get(':postId/comments')
  @ApiOperation({ summary: 'A post comment thread with replies' })
  @ApiQuery({ name: 'sort', required: false, enum: ['best', 'new', 'old'] })
  getComments(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Param('postId') postId: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feed.getComments(tenant.id, postId, user?.id, {
      sort: (sort as CommentSort) ?? 'best',
      limit: limit ? +limit : 200,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Create a post' })
  createPost(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body()
    body: { content: string; mediaUrls?: string[]; tags?: string[]; isPublic?: boolean },
  ) {
    return this.feed.createPost({
      userId: user.id,
      tenantId: tenant.id,
      content: body.content,
      mediaUrls: body.mediaUrls,
      tags: body.tags,
      isPublic: body.isPublic,
    });
  }

  @Post(':postId/vote')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiOperation({ summary: 'Upvote (1), downvote (-1) or withdraw (0) a vote on a post' })
  votePost(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
    @Body() body: { value: number },
  ) {
    return this.feed.votePost(tenant.id, postId, user.id, Number(body?.value));
  }

  @Post(':postId/like')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deprecated: use /vote. Kept so older clients keep working.' })
  async legacyLike(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
  ) {
    const result = await this.feed.votePost(tenant.id, postId, user.id, 1);
    return { liked: true, score: result.score };
  }

  @Post('comments/:commentId/vote')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiOperation({ summary: 'Vote on a comment' })
  voteComment(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('commentId') commentId: string,
    @Body() body: { value: number },
  ) {
    return this.feed.voteComment(tenant.id, commentId, user.id, Number(body?.value));
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Comment on a post, optionally as a reply' })
  addComment(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
    @Body() body: { content: string; parentId?: string | null },
  ) {
    return this.feed.addComment(tenant.id, postId, user.id, body.content, body.parentId ?? null);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a comment (author or moderator)' })
  deleteComment(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string; role?: string },
    @Param('commentId') commentId: string,
  ) {
    const isModerator = user.role === 'admin' || user.role === 'super_admin' || user.role === 'moderator';
    return this.feed.deleteComment(tenant.id, commentId, user.id, isModerator);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete one of my posts' })
  deletePost(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') postId: string,
  ) {
    return this.feed.deletePost(tenant.id, postId, user.id);
  }
}
