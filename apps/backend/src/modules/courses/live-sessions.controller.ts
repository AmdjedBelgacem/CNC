import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LiveSessionsService } from './live-sessions.service';

type Viewer = { id: string; role: string; tenantId: string } | null;

/**
 * Learner-facing live session reads.
 *
 * Admin CRUD lives on AdminCoursesController; this controller only exposes the
 * enrolled-learner surface. The list is public-with-optional-auth (visitors see
 * the schedule, never the Meet URL); join and the cross-enrollment "next
 * session" require a real login.
 */
@ApiTags('live-sessions')
@Controller()
@TenantScoped()
export class LiveSessionsController {
  constructor(private liveSessions: LiveSessionsService) {}

  @Public()
  @Get('courses/:courseId/live-sessions')
  @UseGuards(OptionalAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'List a course\'s visible live sessions (no Meet URLs; joinState per session)' })
  list(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: Viewer,
    @Param('courseId') courseId: string,
  ) {
    return this.liveSessions.listForLearner(tenant.id, courseId, user);
  }

  @Get('live-sessions/next')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Next upcoming live session across my enrollments' })
  next(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.liveSessions.nextForUser(tenant.id, user.id);
  }

  @Get('live-sessions/:id/join')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get the Meet URL when enrolled and inside the join window; 403 with reason otherwise' })
  join(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string; role: string; tenantId: string },
    @Param('id') id: string,
  ) {
    return this.liveSessions.join(tenant.id, id, user);
  }
}
