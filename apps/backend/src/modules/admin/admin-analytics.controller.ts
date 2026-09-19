import { Controller, Get, Query, UseGuards, Req, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { RedisService } from '../auth/services/redis.service';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { eq } from 'drizzle-orm';

// Dedicated analytics surface — cacheable time-series + overview for dashboards.
// Guards reuse the existing tenant+role stack; super_admin may pass ?tenantId=.
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminAnalyticsController {
  // Tiny in-process TTL cache; upgrade to Redis GET/SETEX via RedisService later
  private cache = new Map<string, { exp: number; body: unknown }>();
  private readonly logger = new Logger(AdminAnalyticsController.name);

  constructor(
    private admin: AdminService,
    private redis: RedisService,
    private drizzle: DrizzleService,
  ) {}

  private async cached<T>(ns: string, tenantId: string, range: string, fn: () => Promise<T>, ttlSec = 300): Promise<T> {
    const key = `analytics:${ns}:${tenantId}:${range}`;
    const now = Date.now();

    // Prefer Redis if available (300s TTL); fall back to in-memory
    const fromRedis = await (async () => {
      try {
        const hit = await this.redis.get(key);
        if (hit) return JSON.parse(hit) as T;
      } catch {}
      return null;
    })();
    if (fromRedis) return fromRedis;

    const hit = this.cache.get(key);
    if (hit && hit.exp > now) return hit.body as T;

    const body = await fn();
    this.cache.set(key, { exp: now + ttlSec * 1000, body });
    try {
      await this.redis.setex(key, ttlSec, JSON.stringify(body));
    } catch {}
    // Prune in-process cache lazily
    if (this.cache.size > 120) {
      for (const [k, v] of this.cache) if (v.exp <= now) this.cache.delete(k);
    }
    return body;
  }

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
    @Query('compare') compare?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = await this.effectiveTenant(req, tenantId);
    const r = range || '30d';
    const c = compare === 'prev' ? 'prev' : 'prev';
    return this.cached(`overview:${c}`, tid, r, () => this.admin.getOverview(tid, r), 300);
  }

  @Get('enrollments')
  @Roles('super_admin', 'admin')
  async enrollments(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.cached('enrollments', tid, range || '30d', () => this.admin.getEnrollmentsSeries(tid, range || '30d'));
  }

  @Get('revenue')
  @Roles('super_admin', 'admin')
  async revenue(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.cached('revenue', tid, range || '30d', () => this.admin.getRevenueSeries(tid, range || '30d'));
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
    return this.cached(`top-${lim}`, tid, range || '30d', () => this.admin.getTopCourses(tid, range || '30d', lim), 300);
  }

  @Get('trends')
  @Roles('super_admin', 'admin')
  async trends(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.cached('trends', tid, range || '30d', () => this.admin.getTrends(tid, range || '30d'), 300);
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
    return this.cached(`breakdowns:${lim}`, tid, range || '30d', () => this.admin.getBreakdowns(tid, range || '30d', lim), 300);
  }

  @Get('insights')
  @Roles('super_admin', 'admin')
  async insights(@Req() req: any, @Query('range') range?: string, @Query('tenantId') tenantId?: string) {
    const tid = await this.effectiveTenant(req, tenantId);
    return this.cached('insights', tid, range || '30d', () => this.admin.getInsights(tid, range || '30d'), 300);
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
    return this.cached(`activity:${lim}`, tid, range || '30d', () => this.admin.getActivity(tid, range || '30d', lim), 60);
  }
}
