import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AdminService } from './admin.service';

// Tenant profile management for /admin/settings.
// slug + isActive are intentionally immutable here (no danger-zone yet).
@ApiTags('admin-tenant')
@Controller('admin/tenant')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminTenantController {
  constructor(private admin: AdminService) {}

  @Get()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Current tenant profile' })
  profile(@CurrentTenant() tenant: { id: string }) {
    return this.admin.getTenantProfile(tenant.id);
  }

  @Patch()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update tenant profile (whitelisted fields)' })
  update(@Req() req: any, @CurrentTenant() tenant: { id: string }, @Body() patch: Record<string, unknown>) {
    return this.admin.updateTenantProfile(String((req.user as any)?.id ?? ''), tenant.id, patch);
  }
}
