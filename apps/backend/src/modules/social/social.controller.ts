import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private social: SocialService) {}

  /**
   * Public profile. `OptionalAuthGuard` is what makes `isFollowing` real — with
   * no guard attached `@CurrentUser()` is always undefined, so the field would
   * silently report "not following" to every signed-in visitor.
   */
  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get('profile/:userId')
  @ApiOperation({ summary: 'Get public user profile with stats, learning record and portfolio' })
  getProfile(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Param('userId') userId: string,
  ) {
    return this.social.getProfile(tenant.id, userId, user?.id);
  }

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get('profile/:userId/posts')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: "List a user's public posts" })
  getProfilePosts(
    @CurrentTenant() tenant: { id: string },
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.social.getProfilePosts(tenant.id, userId, page ? +page : 1, limit ? +limit : 10);
  }

  @Public()
  @Get('profile/:userId/courses')
  @ApiOperation({ summary: "List a user's enrollments with progress and certificates" })
  getProfileCourses(
    @CurrentTenant() tenant: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.social.getProfileCourses(tenant.id, userId);
  }

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get('profile/:userId/connections')
  @ApiQuery({ name: 'kind', required: true, enum: ['followers', 'following'] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiOperation({ summary: "List a user's followers or following" })
  async getConnections(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() viewer: { id: string } | undefined,
    @Param('userId') userId: string,
    @Query('kind') kind: 'followers' | 'following',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const safeKind = kind === 'following' ? 'following' : 'followers';
    const result = await this.social.getConnections(
      tenant.id,
      userId,
      safeKind,
      limit ? +limit : 24,
      offset ? +offset : 0,
    );
    // Let the list render Follow/Following without a second request.
    const statuses = viewer
      ? await this.social.getFollowStatuses(viewer.id, result.data.map((row) => row.id))
      : {};
    return {
      ...result,
      data: result.data.map((row) => ({ ...row, isFollowing: !!statuses[row.id] })),
    };
  }

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get('follow/status/:userId')
  @ApiOperation({ summary: 'Whether the viewer follows this user' })
  getFollowStatus(
    @CurrentUser() viewer: { id: string } | undefined,
    @Param('userId') userId: string,
  ) {
    return this.social.getFollowStatus(viewer?.id, userId);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Get('follow/status')
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated user ids' })
  @ApiOperation({ summary: 'Follow state for many users at once' })
  getFollowStatuses(@CurrentUser() user: { id: string }, @Query('ids') ids: string) {
    const list = (ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    return this.social.getFollowStatuses(user.id, list);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Get('suggestions')
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: 'Members the viewer may want to follow' })
  suggestions(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.social.getSuggestions(tenant.id, user.id, limit ? +limit : 6);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  updateProfile(
    @CurrentUser() user: { id: string; tenantId: string },
    @Body() body: { name?: string; headline?: string; bio?: string; avatarUrl?: string; location?: string },
  ) {
    return this.social.updateProfile(user.id, user.tenantId, body);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Post('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user (idempotent)' })
  follow(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.social.follow(user.id, userId);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Delete('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user (idempotent)' })
  unfollow(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.social.unfollow(user.id, userId);
  }

  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  @Post('portfolio')
  @ApiOperation({ summary: 'Add portfolio item' })
  addPortfolio(
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; description?: string; imageUrl?: string; tags?: string[] },
  ) {
    return this.social.addPortfolioItem(user.id, body);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  search(
    @CurrentTenant() tenant: { id: string },
    @Query('q') q: string,
  ) {
    return this.social.searchUsers(tenant.id, q || '');
  }
}
