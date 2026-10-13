import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PartnersService } from './partners.service';
import { AdminListApplicationsQuery, UpdatePartnerApplicationDto } from './dto/partner-application.dto';

@ApiTags('admin-partners')
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
@Roles('super_admin', 'admin')
export class PartnersAdminController {
  constructor(private service: PartnersService) {}

  @Get('applications')
  @ApiOperation({ summary: 'List partner applications' })
  async list(@Query() query: AdminListApplicationsQuery, @CurrentTenant() tenant: any) {
    return this.service.listForAdmin(tenant.id, query);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get partner application' })
  async detail(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.service.getDetail(tenant.id, id);
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Update application status/notes' })
  async update(@Param('id') id: string, @Body() body: UpdatePartnerApplicationDto, @CurrentTenant() tenant: any, @CurrentUser() user: any) {
    return this.service.updateStatus(tenant.id, id, body, user?.id ?? user?.sub);
  }

  @Post('applications/:id/approve')
  async approve(@Param('id') id: string, @Body() body: any, @CurrentTenant() tenant: any, @CurrentUser() user: any) {
    return this.service.approve(tenant.id, id, user?.id ?? user?.sub, body?.notes);
  }

  @Post('applications/:id/reject')
  async reject(@Param('id') id: string, @Body() body: any, @CurrentTenant() tenant: any, @CurrentUser() user: any) {
    if (!body?.reason) throw new (await import('@nestjs/common')).BadRequestException('reason required');
    return this.service.reject(tenant.id, id, user?.id ?? user?.sub, body.reason, body?.notes);
  }

  @Post('applications/:id/request-info')
  async requestInfo(@Param('id') id: string, @Body() body: any, @CurrentTenant() tenant: any, @CurrentUser() user: any) {
    if (!body?.message) throw new (await import('@nestjs/common')).BadRequestException('message required');
    return this.service.requestInfo(tenant.id, id, user?.id ?? user?.sub, body.message, body?.notes);
  }
}
