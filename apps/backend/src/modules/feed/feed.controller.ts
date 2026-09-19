import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private feed: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get public social feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFeed(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feed.getFeed(tenant.id, +page, +limit, user?.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get feed from followed users' })
  getMyFeed(
    @CurrentUser() user: { id: string },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feed.getUserFeed(user.id, +page, +limit);
  }

  @Get(':postId/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  getComments(
    @Param('postId') postId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feed.getComments(postId, +page, +limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create a post' })
  createPost(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: { id: string },
    @Body() body: { content: string; mediaUrls?: string[]; tags?: string[]; isPublic?: boolean },
  ) {
    return this.feed.createPost({ ...body, userId: user.id, tenantId: tenant.id });
  }

  @Post(':postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle like on a post' })
  toggleLike(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
  ) {
    return this.feed.toggleLike(postId, user.id);
  }

  @Post(':postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment' })
  addComment(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
    @Body('content') content: string,
  ) {
    return this.feed.addComment(postId, user.id, content);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own post' })
  deletePost(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.feed.deletePost(id, user.id);
  }
}
