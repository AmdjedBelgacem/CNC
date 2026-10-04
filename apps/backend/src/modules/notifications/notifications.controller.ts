import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications with cursor pagination' })
  async findMy(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    const unreadOnly = unread === 'true' || unread === '1';
    return this.notifications.list(user.id, {
      tenantId: user.tenantId,
      cursor,
      limit,
      unreadOnly,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.notifications.unreadCount(user.id, user.tenantId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.notifications.markRead(user.id, id, user.tenantId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.notifications.markAllRead(user.id, user.tenantId);
  }
}
