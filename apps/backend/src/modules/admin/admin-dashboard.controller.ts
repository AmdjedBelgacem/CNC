import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { RedisService } from '../auth/services/redis.service';

// Dashboard pulse surface — operational "needs attention" feed for /admin.
// Tenant-scoped via global guards; super_admin may pass ?tenantId= later (v2 switcher).
@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminDashboardController {
  constructor(
    private admin: AdminService,
    private redis: RedisService,
  ) {}

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {}
    const body = await fn();
    try {
      await this.redis.setex(key, 60, JSON.stringify(body));
    } catch {}
    return body;
  }

  @Get('pulse')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Needs-attention counts + recent enrollments for admin dashboard' })
  pulse(@Req() req: any) {
    const tenantId = String((req.user as any)?.tenantId || (req.tenant as any)?.id || '');
    return this.cached(`dashboard:pulse:${tenantId}`, () => this.admin.getDashboardPulse(tenantId));
  }
}
