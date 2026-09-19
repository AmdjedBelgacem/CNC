import { Controller, Get, Post, Patch, Delete, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RbacService } from '../rbac/rbac.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminRolesController {
  constructor(private rbac: RbacService) {}

  @Get('roles')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @ApiOperation({ summary: 'List tenant roles' })
  async listRoles(@CurrentTenant() tenant: any) {
    return this.rbac.listRoles(tenant.id);
  }

  @Get('permissions')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @ApiOperation({ summary: 'List the permission catalog (grouped)' })
  async listPermissions() {
    return this.rbac.listPermissions();
  }

  @Post('roles')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom role' })
  async createRole(
    @CurrentUser() actor: any,
    @CurrentTenant() tenant: any,
    @Body() body: { name: string; description?: string; key?: string },
  ) {
    return this.rbac.createRole(actor, tenant.id, body);
  }

  @Get('roles/:id')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @ApiOperation({ summary: 'Get a role with its permissions' })
  async getRole(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.rbac.getRole(tenant.id, id);
  }

  @Patch('roles/:id')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @ApiOperation({ summary: 'Update a custom role' })
  async updateRole(
    @CurrentUser() actor: any,
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rbac.updateRole(actor, tenant.id, id, body);
  }

  @Delete('roles/:id')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a custom role' })
  async deleteRole(@CurrentUser() actor: any, @CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.rbac.deleteRole(actor, tenant.id, id);
  }

  @Put('roles/:id/permissions')
  @Roles('super_admin', 'admin')
  @Permissions('staff:manage_roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a role’s permissions (full replace)' })
  async setRolePermissions(
    @CurrentUser() actor: any,
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.rbac.setRolePermissions(actor, tenant.id, id, body.permissions || []);
  }

  @Get('users/:id/roles')
  @Roles('super_admin', 'admin')
  @Permissions('staff:assign_roles')
  @ApiOperation({ summary: 'List roles assigned to a user' })
  async getUserRoles(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.rbac.getUserRoles(tenant.id, id);
  }

  @Put('users/:id/roles')
  @Roles('super_admin', 'admin')
  @Permissions('staff:assign_roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign roles to a user (full replace)' })
  async setUserRoles(
    @CurrentUser() actor: any,
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.rbac.setUserRoles(actor, tenant.id, id, body.roleIds || []);
  }
}
