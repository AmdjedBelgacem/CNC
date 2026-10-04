import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformAlertsService } from './platform-alerts.service';
import { PLATFORM_ALERT_GROUPS } from './platform-alert-groups';

class UpdatePrefsDto {
  /** `{ payments: false, security: true, ... }` — validated per key in the service. */
  @IsObject() prefs!: Record<string, boolean>;
}

class MarkReadDto {
  @IsOptional() @IsBoolean() all?: boolean;
  @IsOptional() group?: string;
}

/**
 * Platform-critical alert feed and settings.
 *
 * Super-admin only, and separate from `/notifications` on purpose: that feed is
 * the reader's own tenant activity. These alerts are cross-tenant operational
 * signals, so they are selected by `audience = 'platform'` rather than by
 * tenant, and each super admin controls their own view of them.
 */
@ApiTags('platform-alerts')
@Controller('admin/platform-alerts')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
@Roles('super_admin')
@ApiBearerAuth()
export class PlatformAlertsController {
  constructor(private alerts: PlatformAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List platform alerts' })
  list(
    @CurrentUser() user: { id: string; role?: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('group') group?: string,
    @Query('severity') severity?: string,
  ) {
    return this.alerts.list(user, {
      limit: Number(limit) || undefined,
      cursor,
      unreadOnly: unreadOnly === 'true',
      group,
      severity,
    });
  }

  @Get('overview')
  @ApiOperation({ summary: 'Platform alert counts by severity and group' })
  overview(@CurrentUser() user: { id: string; role?: string }) {
    return this.alerts.overview(user);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Alert groups with this super admin current toggles' })
  settings(@CurrentUser() user: { id: string; role?: string }) {
    return this.alerts.settings(user);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Set which platform alert groups are shown' })
  updateSettings(
    @CurrentUser() user: { id: string; role?: string },
    @Body() dto: UpdatePrefsDto,
    @Req() req: any,
  ) {
    return this.alerts.updatePrefs(
      user,
      dto.prefs ?? {},
      (req as any)?.ip,
      (req as any)?.headers?.['user-agent'],
    );
  }

  @Get('groups')
  @ApiOperation({ summary: 'The platform alert group registry' })
  groups() {
    return { groups: PLATFORM_ALERT_GROUPS };
  }

  // The `:id` has to be part of the path. A bare `@Param('id')` on a
  // `@Post('read')` handler binds `undefined` — the route maps to `/read` and
  // the client's `read/{id}` call 404s.
  @Post('read/:id')
  @ApiOperation({ summary: 'Mark one platform alert read' })
  markRead(@CurrentUser() user: { id: string; role?: string }, @Param('id') id: string) {
    return this.alerts.markRead(user, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all platform alerts read, optionally within one group' })
  markAllRead(
    @CurrentUser() user: { id: string; role?: string },
    @Body() dto: MarkReadDto,
  ) {
    return this.alerts.markAllRead(user, dto?.group);
  }
}
