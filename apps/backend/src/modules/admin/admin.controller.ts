import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/services/auth.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CookieService } from '../auth/services/cookie.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private admin: AdminService,
    private auth: AuthService,
    private cookieService: CookieService,
  ) {}

  @Get('stats')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get tenant analytics/stats' })
  getStats(@CurrentTenant() tenant: { id: string }) {
    return this.admin.getStats(tenant.id);
  }

  @Get('users')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List all users (search, filters, pagination)' })
  async listUsers(
    @Query('status') status: string | undefined,
    @Query('role') role: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('joinedFrom') joinedFrom: string | undefined,
    @Query('joinedTo') joinedTo: string | undefined,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.auth.getUsersForAdmin({
      tenantId: tenant.id,
      accountStatus: status,
      role,
      search,
      limit: parseInt(limit || '50'),
      offset: (parseInt(page || '1') - 1) * parseInt(limit || '50'),
      joinedFrom,
      joinedTo,
    });
  }

  @Get('users/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user details (tenant-scoped)' })
  async getUser(@CurrentUser() caller: any, @Param('id') id: string) {
    const target: any = await this.auth.getProfile(id);
    if (!target) return null;
    if (String(caller.tenantId) !== String(target.tenantId) && caller.role !== 'super_admin') {
      throw new (await import('@nestjs/common')).ForbiddenException('Access to this user is not permitted for your tenant');
    }
    return target;
  }

  @Patch('users/:id/role')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Change user role (tenant-scoped)' })
  async changeUserRole(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
    @Body() body: { role: string },
  ) {
    const target: any = await this.auth.getProfile(userId);
    if (target && String(admin.tenantId) !== String(target.tenantId) && admin.role !== 'super_admin') {
      throw new (await import('@nestjs/common')).ForbiddenException('Cross-tenant role change not permitted');
    }
    await this.auth.adminChangeUserRole(admin.id, userId, body.role);
    return { message: 'Role updated' };
  }

  @Post('users/:id/suspend')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Suspend a user (tenant-scoped)' })
  async suspendUser(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
    @Body() body: { reason?: string },
  ) {
    const target: any = await this.auth.getProfile(userId);
    if (target && String(admin.tenantId) !== String(target.tenantId) && admin.role !== 'super_admin') {
      throw new (await import('@nestjs/common')).ForbiddenException('Cross-tenant suspend not permitted');
    }
    await this.auth.adminSuspendUser(admin.id, userId, body.reason);
    return { message: 'User suspended' };
  }

  @Post('users/:id/unsuspend')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Unsuspend a user (tenant-scoped)' })
  async unsuspendUser(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
  ) {
    const target: any = await this.auth.getProfile(userId);
    if (target && String(admin.tenantId) !== String(target.tenantId) && admin.role !== 'super_admin') {
      throw new (await import('@nestjs/common')).ForbiddenException('Cross-tenant unsuspend not permitted');
    }
    await this.auth.adminUnsuspendUser(admin.id, userId);
    return { message: 'User unsuspended' };
  }

  @Post('users/:id/force-password-reset')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Force password reset for user (tenant-scoped)' })
  async forcePasswordReset(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
  ) {
    const target: any = await this.auth.getProfile(userId);
    if (target && String(admin.tenantId) !== String(target.tenantId) && admin.role !== 'super_admin') {
      throw new (await import('@nestjs/common')).ForbiddenException('Cross-tenant action not permitted');
    }
    return this.auth.adminForcePasswordReset(admin.id, userId);
  }

  @Post('users/:id/impersonate')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Impersonate a user (sets impersonation cookies)' })
  async impersonateUser(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    // Capture admin's refresh token so /impersonate/end can restore their session
    const adminRefreshRaw =
      req.cookies?.['refresh-token'] ||
      req.cookies?.['__Host-refresh'] ||
      req.cookies?.['__refresh-fallback'] ||
      null;
    const result: any = await this.auth.impersonateUser(admin.id, userId, req.ip, req.headers['user-agent'], adminRefreshRaw);
    try {
      this.cookieService.setAuthCookies(reply, result.accessToken, result.refreshToken, false);
      this.cookieService.setImpersonationFlag(reply);
    } catch {}
    return result;
  }

  @Post('impersonate/end')
  @Roles('super_admin', 'admin', 'moderator', 'instructor', 'sponsor', 'learner')
  @ApiOperation({ summary: 'End impersonation and restore admin session' })
  async endImpersonation(
    @Req() req: any,
    @CurrentUser() _user: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const authHeader: string | undefined = req.headers?.authorization;
    const accessCookie =
      req.cookies?.['access-token'] ||
      req.cookies?.['__Host-access'] ||
      null;
    const impersonationToken =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || accessCookie;

    const restored = await this.auth.endImpersonation(impersonationToken);
    try {
      if (restored) {
        this.cookieService.setAuthCookies(reply, restored.accessToken, restored.refreshToken, true);
      } else {
        this.cookieService.clearAuthCookies(reply);
      }
      this.cookieService.clearImpersonationFlag(reply);
    } catch {}
    return { message: restored ? 'Impersonation ended — admin session restored' : 'Impersonation ended — please sign in again', restored: !!restored };
  }

  @Delete('users/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Soft delete a user' })
  async deleteUser(
    @CurrentUser() admin: any,
    @Param('id') userId: string,
  ) {
    await this.auth.softDeleteUser(userId, admin.id);
    return { message: 'User deleted' };
  }

  @Get('audit-logs')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'View audit logs' })
  async getAuditLogs(
    @Query('userId') userId: string | undefined,
    @Query('action') action: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @CurrentTenant() tenant: { id: string },
  ) {
    return this.auth.getAuditLogs({
      userId,
      action,
      tenantId: tenant.id,
      limit: parseInt(limit || '50'),
      offset: parseInt(offset || '0'),
    });
  }

  @Get('sessions')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List user sessions for admin' })
  async listSessions(@Query('userId') userId: string | undefined) {
    if (!userId) return { sessions: [] };
    return this.auth.getSessions(userId);
  }

  @Post('sessions/:id/revoke')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Force revoke a session' })
  async revokeSession(
    @Param('id') sessionId: string,
    @Body() body: { userId: string },
  ) {
    await this.auth.revokeSession(sessionId, body.userId);
    return { message: 'Session revoked' };
  }

  @Get('sponsors')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List all sponsors for admin' })
  listSponsors(@CurrentTenant() tenant: { id: string }) {
    return this.admin.listSponsors(tenant.id);
  }

  @Post('sponsors')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a sponsor' })
  createSponsor(@CurrentTenant() tenant: { id: string }, @Body() body: any) {
    return this.admin.createSponsor(tenant.id, body);
  }

  @Patch('sponsors/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a sponsor' })
  updateSponsor(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateSponsor(tenant.id, id, body);
  }

  @Delete('sponsors/:id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a sponsor' })
  deleteSponsor(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.admin.deleteSponsor(tenant.id, id);
  }

  @Get('orders')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List orders for tenant (admin visibility, tenant-isolated)' })
  async listOrders(
    @CurrentTenant() tenant: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listOrders(tenant.id, parseInt(page || '1'), parseInt(limit || '20'));
  }

  // Staff management
  @Get('staff')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List staff members (tenant-isolated)' })
  async listStaff(
    @CurrentTenant() tenant: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listStaff(
      tenant.id,
      parseInt(page || '1'),
      parseInt(limit || '20'),
      search,
      role,
      status,
    );
  }

  @Post('staff/invite')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Invite a staff member' })
  async inviteStaff(
    @CurrentUser() actor: { id: string; tenantId: string },
    @Body() body: { email: string; name?: string; role: string; username?: string },
  ) {
    return this.admin.inviteStaff(actor.tenantId, actor.id, body);
  }

  // Learners (Users section)
  @Get('users/learners')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List learners (customers) with filters' })
  async listLearners(
    @CurrentTenant() tenant: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.listLearners(
      tenant.id,
      parseInt(page || '1'),
      parseInt(limit || '20'),
      search,
      status,
      from,
      to,
    );
  }

  @Get('users/:id/purchases')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user purchases (orders)' })
  async getUserPurchases(
    @CurrentTenant() tenant: { id: string },
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getUserPurchases(tenant.id, userId, parseInt(page || '1'), parseInt(limit || '20'));
  }

  @Get('users/:id/enrollments')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user enrollments' })
  async getUserEnrollments(
    @CurrentTenant() tenant: { id: string },
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getUserEnrollments(tenant.id, userId, parseInt(page || '1'), parseInt(limit || '20'));
  }

  @Get('users/:id/certificates')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user certificates' })
  async getUserCertificates(
    @CurrentTenant() tenant: { id: string },
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getUserCertificates(tenant.id, userId, parseInt(page || '1'), parseInt(limit || '20'));
  }

  @Get('users/:id/learning')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get user learning progress summary' })
  async getUserLearning(
    @CurrentTenant() tenant: { id: string },
    @Param('id') userId: string,
  ) {
    return this.admin.getUserLearningProgress(tenant.id, userId);
  }

  @Post('rotate-key')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Rotate JWT signing key' })
  async rotateSigningKey() {
    return this.auth.rotateSigningKey();
  }
}
