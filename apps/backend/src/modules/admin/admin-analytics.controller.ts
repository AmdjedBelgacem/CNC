import { Controller, Get, Query, UseGuards, Req, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { eq } from 'drizzle-orm';

// Dedicated analytics surface — time-series + overview for dashboards.
// Guards reuse the existing tenant+role stack; super_admin may pass ?tenantId=.
//
// Results are NOT cached. A 300s Redis/in-process TTL previously meant a dashboard
// kept showing numbers from before an enrollment or purchase, which read as broken
// analytics rather than a slow cache. Every request now hits the database.
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminAnalyticsController {
  private readonly logger = new Logger(AdminAnalyticsController.name);

  constructor(
    private admin: AdminService,
    private drizzle: DrizzleService,
  ) {}

  private async effectiveTenant(req: any, queryTenantId?: string): Promise<string> {
    const actorRole = (req.user as any)?.role;
    const actorId = (req.user as any)?.id;
    if (actorRole === 'super_admin' && queryTenantId) {
      const v = String(queryTenantId).trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
        throw new BadRequestException('Invalid tenantId');
      }
      const tenant = await this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, v) });
      if (!tenant || !tenant.isActive) throw new NotFoundException('Tenant not found or inactive');
      this.logger.log(`super_admin ${actorId} tenant override → ${v} (${tenant.slug}) via ${req.method} ${req.url}`);
      return v;
    }
    const tid = String((req.user as any)?.tenantId || '');
    if (!tid) throw new ForbiddenException('Tenant context required');
    return tid;
  }

  @Get('overview')
  @Roles('super_admin', 'admin')
  async overview(
    @Req() req: any,
    @Query('range') range?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = await this.effectiveTenant(req, tenantId);
    const r = range || '30d';
    return this.admin.getOverview(tid, r);
  }

  @Get('enrollments')
  @Roles('super_admin', 'admin')
  async enrollments(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.admin.getEnrollmentsSeries(tid, range || '30d');
  }

  @Get('revenue')
  @Roles('super_admin', 'admin')
  async revenue(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.admin.getRevenueSeries(tid, range || '30d');
  }

  @Get('top-courses')
  @Roles('super_admin', 'admin')
  async topCourses(
    @Req() req: any,
    @Query('range') range?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const tid = await this.effectiveTenant(req, tenantId);
    const lim = limit ? Math.min(20, Math.max(1, Number(limit))) : 8;
    return this.admin.getTopCourses(tid, range || '30d', lim);
  }

  @Get('trends')
  @Roles('super_admin', 'admin')
  async trends(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.admin.getTrends(tid, range || '30d');
  }

  @Get('breakdowns')
  @Roles('super_admin', 'admin')
  async breakdowns(
    @Req() req: any,
    @Query('range') range?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const tid = await this.effectiveTenant(req, tenantId);
    const lim = limit ? Math.min(20, Math.max(1, Number(limit))) : 8;
    return this.admin.getBreakdowns(tid, range || '30d', lim);
  }

  @Get('insights')
  @Roles('super_admin', 'admin')
  async insights(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.admin.getInsights(tid, range || '30d');
  }

  @Get('activity')
  @Roles('super_admin', 'admin')
  async activity(
    @Req() req: any,
    @Query('range') range?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const tid = await this.effectiveTenant(req, tenantId);
    const lim = limit ? Math.min(30, Math.max(1, Number(limit))) : 15;
    return this.admin.getActivity(tid, range || '30d', lim);
  }
}
