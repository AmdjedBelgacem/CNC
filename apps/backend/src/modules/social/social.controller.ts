import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private social: SocialService) {}

  @Get('profile/:userId')
  @ApiOperation({ summary: 'Get public user profile' })
  getProfile(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string } | undefined,
    @Param('userId') userId: string,
  ) {
    return this.social.getProfile(tenant.id, userId, user?.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() body: { name?: string; headline?: string; bio?: string; avatarUrl?: string; location?: string },
  ) {
    return this.social.updateProfile(user.id, body);
  }

  @Post('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  follow(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.social.follow(user.id, userId);
  }

  @Delete('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.social.unfollow(user.id, userId);
  }

  @Post('portfolio')
  @ApiOperation({ summary: 'Add portfolio item' })
  addPortfolio(
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; description?: string; imageUrl?: string; tags?: string[] },
  ) {
    return this.social.addPortfolioItem(user.id, body);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  search(
    @CurrentTenant() tenant: { id: string },
    @Query('q') q: string,
  ) {
    return this.social.searchUsers(tenant.id, q || '');
  }
}
