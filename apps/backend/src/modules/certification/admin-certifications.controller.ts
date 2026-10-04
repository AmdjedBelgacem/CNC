import { Controller, Get, Post, Param, Query, Body, UseGuards, Req, Res, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CertificationService } from './certification.service';

class RevokeCertDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

class ManualIssueDto {
  @IsString() @IsUUID() userId!: string;
  @IsString() @IsUUID() courseId!: string;
  @IsOptional() @IsString() @IsUUID() templateId?: string;
  @IsOptional() @IsString() expiresAt?: string;
}

// Admin certificate management — role-guarded, tenant-scoped.
@ApiTags('admin-certifications')
@Controller('admin/certifications')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminCertificationsController {
  private readonly logger = new Logger(AdminCertificationsController.name);
  constructor(private certification: CertificationService) {}

  private effectiveTenant(req: any, queryTenantId?: string): string {
    const actorRole = (req.user as any)?.role;
    const actorId = (req.user as any)?.id;
    if (actorRole === 'super_admin' && queryTenantId) {
      const v = String(queryTenantId).trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
        throw new BadRequestException('Invalid tenantId');
      }
      this.logger.log(`super_admin ${actorId} tenant override → ${v} via ${req.method} ${req.url}`);
      return v;
    }
    const tid = String((req.user as any)?.tenantId || '');
    if (!tid) throw new ForbiddenException('Tenant context required');
    return tid;
  }

  @Get()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List issued certificates with filters' })
  list(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('q') q?: string,
    @Query('courseId') courseId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.certification.findForAdmin(tid, {
      q,
      courseId: courseId || undefined,
      userId: userId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Post('issue')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Manually issue a certificate to a learner for a course' })
  manualIssue(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Body() dto: ManualIssueDto,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const actorId = (req.user as any)?.id;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.certification.manualIssue(tid, actorId, dto, ip, ua);
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Certificate detail' })
  detail(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.certification.findOneForAdmin(tid, id);
  }

  @Post(':id/revoke')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Revoke a certificate with optional reason' })
  revoke(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: RevokeCertDto,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const actorId = (req.user as any)?.id;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.certification.revoke(tid, id, dto.reason, actorId, ip, ua);
  }

  @Post(':id/reissue')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Reissue a replacement certificate (new number)' })
  reissue(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const actorId = (req.user as any)?.id;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.certification.reissue(tid, id, actorId, ip, ua);
  }

  /**
   * Admin download of any certificate in the effective tenant.
   *
   * Tenant-scoped: the lookup is constrained to the tenant the guard resolved,
   * so a super_admin cannot pull another tenant's file by id alone.
   */
  @Get(':id/download')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Download a certificate PDF (admin)' })
  async download(
    @Param('id') id: string,
    @Query('tenantId') queryTenantId: string | undefined,
    @Req() req: any,
    @Res() res: any,
  ) {
    const tenantId = this.effectiveTenant(req, queryTenantId);
    const cert = await this.certification.getForDownload(id, {
      id: (req.user as any)?.id,
      tenantId,
      role: 'admin',
    });
    const body = await this.certification.loadDocument(cert as never);
    if (!body) throw new BadRequestException('No stored PDF for this certificate yet');
    res.header('content-type', 'application/pdf');
    res.header('content-disposition', `attachment; filename="certificate-${cert.certificateNumber}.pdf"`);
    res.header('content-length', String(body.length));
    return res.send(body);
  }

  /**
   * Rebuild a PDF from the immutable payload snapshot.
   *
   * Needed because certificates issued before the renderer existed have no
   * stored file; their snapshot still carries the resolved values, so they can
   * be brought forward without re-issuing (which would mint a new number).
   */
  @Post(':id/regenerate-pdf')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Regenerate a certificate PDF from its payload snapshot' })
  async regenerate(
    @Param('id') id: string,
    @Query('tenantId') queryTenantId: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = this.effectiveTenant(req, queryTenantId);
    const result = await this.certification.regeneratePdf(id, tenantId);
    return {
      regenerated: true,
      bytes: result.bytes,
      pdfUrl: result.url,
      pdfStorageKey: result.key,
    };
  }
}
