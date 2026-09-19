import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AcademiesService } from './academies.service';
import { CreateAcademyDto, UpdateAcademyDto, AssignCoursesDto, AcademyImageUploadDto } from './dto/academies.dto';

// Admin academy management surface — role-guarded, tenant-scoped, same pattern
// as admin-courses.controller.ts. Academy assignment never touches
// enrollments/progress/certificates.
@ApiTags('admin-academies')
@Controller('admin/academies')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminAcademiesController {
  private readonly logger = new Logger(AdminAcademiesController.name);

  constructor(private academies: AcademiesService) {}

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
  @ApiOperation({ summary: 'List academies with status filters + course counts' })
  list(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.academies.findForAdmin(tid, {
      status,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('backfill/report')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Pre-flight report: unassigned courses, duplicate slugs, proposed default academy' })
  backfillReport(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.academies.backfillReport(tid);
  }

  @Post('backfill/run')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create the tenant-derived default academy and assign all unassigned courses (idempotent)' })
  runBackfill(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.academies.runBackfill(tid);
  }

  @Post()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create an academy draft' })
  create(@CurrentTenant() tenant: { id: string }, @Body() dto: CreateAcademyDto) {
    return this.academies.create(tenant.id, dto);
  }

  @Patch(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update academy fields' })
  update(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string, @Body() dto: UpdateAcademyDto) {
    return this.academies.update(tenant.id, slug, dto);
  }

  @Get(':slug/validate')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Check whether an academy is ready to publish and why not' })
  validate(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.validateForPublish(tenant.id, slug);
  }

  @Post(':slug/publish')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Publish an academy' })
  publish(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.publish(tenant.id, slug);
  }

  @Post(':slug/unpublish')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Unpublish an academy (back to draft)' })
  unpublish(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.unpublish(tenant.id, slug);
  }

  @Post(':slug/archive')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Archive an academy (courses are untouched)' })
  archive(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.archive(tenant.id, slug);
  }

  @Post(':slug/restore')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Restore an archived academy' })
  restore(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.restore(tenant.id, slug);
  }

  // ---- Branding & SEO images: upload-only. No external URL entry is ever accepted. ----
  @Post(':slug/images')
  @Roles('super_admin', 'admin')
  @ApiOperation({
    summary: 'Upload a branding or SEO image for an academy (upload-only, no URL).',
    description: 'kind=hero (1920x1080 banner), logo (square/mark), seo (og:image 1200x630). Body: { kind, image: data:image/png;base64,... }. The image is stored tenant-scoped and the academy row is updated atomically. Old image for that kind is deleted.',
  })
  uploadImage(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() dto: AcademyImageUploadDto,
  ) {
    return this.academies.uploadImage(tenant.id, slug, dto.kind, dto.image, dto.filename);
  }

  @Delete(':slug/images/:kind')
  @Roles('super_admin', 'admin')
  @ApiOperation({
    summary: 'Remove a branding/SEO image from an academy',
    description: 'kind = hero | logo | seo. Clears the DB column and deletes the stored file if it was owned by this tenant.',
  })
  deleteImage(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Param('kind') kind: string,
  ) {
    if (!['hero', 'logo', 'seo'].includes(kind)) throw new BadRequestException('kind must be hero, logo or seo');
    return this.academies.deleteImage(tenant.id, slug, kind as 'hero' | 'logo' | 'seo');
  }

  @Post(':slug/courses')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Assign/move courses into this academy' })
  assignCourses(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() dto: AssignCoursesDto,
  ) {
    return this.academies.assignCourses(tenant.id, slug, dto.courseSlugs);
  }

  @Delete(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete an academy (only when it has no courses)' })
  remove(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.remove(tenant.id, slug);
  }

  // Placed after param routes so 'backfill' is not captured as :slug — see
  // list()/backfill above; this full-detail load must come last.
  @Get(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Load an academy with its course roster' })
  detail(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.academies.getAdminDetail(tenant.id, slug);
  }
}
