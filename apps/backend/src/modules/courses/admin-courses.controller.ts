import { Controller, Get, Post, Patch, Put, Delete, Param, Query, Body, UseGuards, Req, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CoursesService } from './courses.service';
import { UploadService } from '../auth/services/upload.service';
import {
  CreateCourseDto,
  CreateSeriesDto,
  UpdateSeriesDto,
  CreateLessonDto,
  UpdateLessonDto,
  ReorderCurriculumDto,
  UploadFileDto,
  LessonUploadUrlDto,
  LessonUploadDto,
  CreateLessonBlockDto,
  UpdateLessonBlockDto,
  ReorderLessonBlocksDto,
  LessonContentDocumentDto,
  UpdateCourseDto,
} from './dto/courses.dto';

// Admin course management surface — role-guarded, tenant-scoped.
// The public /courses controller remains untouched for student flows.
@ApiTags('admin-courses')
@Controller('admin/courses')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminCoursesController {
  private readonly logger = new Logger(AdminCoursesController.name);
  constructor(
    private courses: CoursesService,
    private upload: UploadService,
  ) {}

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

  @Post('upload')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Upload a generic file (lesson media, attachments)' })
  uploadFile(@Body() body: UploadFileDto) {
    return this.upload.uploadGeneric(body.file, body.folder || 'courses', body.name);
  }

  @Get()
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'List courses with status filters + metrics (enrollments, lessons)' })
  list(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('academy') academy?: string,
    @Query('enrollments') enrollments?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.courses.findForAdmin(tid, {
      status,
      search,
      academy,
      zeroEnrollments: enrollments === '0',
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Post()
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Create a course' })
  create(@CurrentTenant() tenant: { id: string }, @Body() dto: CreateCourseDto) {
    return this.courses.createCourse(tenant.id, dto);
  }

  @Patch(':slug')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Update course metadata' })
  update(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string, @Body() dto: UpdateCourseDto) {
    return this.courses.updateCourse(tenant.id, slug, dto);
  }

  @Get(':slug/validate')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Check whether a course is ready to publish and why not' })
  validate(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.validateForPublish(tenant.id, slug);
  }

  @Post(':slug/publish')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Publish a course' })
  publish(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.publishCourse(tenant.id, slug);
  }

  @Post(':slug/unpublish')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Unpublish a course (back to draft)' })
  unpublish(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.unpublishCourse(tenant.id, slug);
  }

  @Post(':slug/archive')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Archive a course' })
  archive(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.archiveCourse(tenant.id, slug);
  }

  @Post(':slug/restore')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Restore an archived course' })
  restore(@CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.restoreCourse(tenant.id, slug);
  }

  // --- Course Studio full load ---
  @Get(':slug')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Load a course with its full curriculum + commerce/SEO for the studio' })
  getStudio(@Req() req: any, @CurrentTenant() tenant: { id: string }, @Param('slug') slug: string) {
    return this.courses.getStudio(tenant.id, slug, req);
  }

  // --- Series (sections) ---
  @Post('series')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Create a section within a course' })
  createSeries(@CurrentTenant() tenant: { id: string }, @Body() dto: CreateSeriesDto) {
    return this.courses.createSeriesSafe(tenant.id, dto);
  }

  @Patch('series/:id')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Update a section' })
  updateSeries(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: UpdateSeriesDto) {
    return this.courses.updateSeries(tenant.id, id, dto);
  }

  @Delete('series/:id')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Delete a section (and its lessons)' })
  deleteSeries(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.courses.deleteSeries(tenant.id, id);
  }

  // --- Lessons ---
  @Post('lessons')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Create a lesson within a section' })
  createLesson(@CurrentTenant() tenant: { id: string }, @Body() dto: CreateLessonDto) {
    return this.courses.createLessonSafe(tenant.id, dto);
  }

  @Patch('lessons/:id')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Update a lesson' })
  updateLesson(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.courses.updateLesson(tenant.id, id, dto);
  }

  @Get('lessons/:id/blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Get a lesson content block document' })
  getBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.courses.getLessonContentBlocks(tenant.id, id);
  }

  @Get('lessons/:id/content-blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Get a lesson content block document' })
  getContentBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.courses.getLessonContentBlocks(tenant.id, id);
  }

  @Post('lessons/:id/content-blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Create a lesson content block' })
  createContentBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: CreateLessonBlockDto) {
    return this.courses.createLessonBlock(tenant.id, id, dto);
  }

  @Put('lessons/:id/content-blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Replace a lesson content block document' })
  replaceContentBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: LessonContentDocumentDto) {
    return this.courses.replaceLessonContentBlocks(tenant.id, id, dto);
  }

  @Post('lessons/:id/content-blocks/reorder')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Reorder lesson content blocks' })
  reorderContentBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: ReorderLessonBlocksDto) {
    return this.courses.reorderLessonBlocks(tenant.id, id, dto);
  }

  @Patch('lessons/:id/content-blocks/:blockId')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Update a lesson content block' })
  updateContentBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Param('blockId') blockId: string, @Body() dto: UpdateLessonBlockDto) {
    return this.courses.updateLessonBlock(tenant.id, id, blockId, dto);
  }

  @Delete('lessons/:id/content-blocks/:blockId')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Delete a lesson content block' })
  deleteContentBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Param('blockId') blockId: string) {
    return this.courses.deleteLessonBlock(tenant.id, id, blockId);
  }

  @Post('lessons/:id/blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Create a lesson content block' })
  createBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: CreateLessonBlockDto) {
    return this.courses.createLessonBlock(tenant.id, id, dto);
  }

  @Put('lessons/:id/blocks')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Replace a lesson content block document' })
  replaceBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: LessonContentDocumentDto) {
    return this.courses.replaceLessonContentBlocks(tenant.id, id, dto);
  }

  @Post('lessons/:id/blocks/reorder')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Reorder lesson content blocks' })
  reorderBlocks(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() dto: ReorderLessonBlocksDto) {
    return this.courses.reorderLessonBlocks(tenant.id, id, dto);
  }

  @Patch('lessons/:id/blocks/:blockId')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Update a lesson content block' })
  updateBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Param('blockId') blockId: string, @Body() dto: UpdateLessonBlockDto) {
    return this.courses.updateLessonBlock(tenant.id, id, blockId, dto);
  }

  @Delete('lessons/:id/blocks/:blockId')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Delete a lesson content block' })
  deleteBlock(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Param('blockId') blockId: string) {
    return this.courses.deleteLessonBlock(tenant.id, id, blockId);
  }

  @Delete('lessons/:id')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Delete a lesson' })
  deleteLesson(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.courses.deleteLesson(tenant.id, id);
  }

  @Post('lessons/:id/duplicate')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Duplicate a lesson within its section' })
  duplicateLesson(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.courses.duplicateLesson(tenant.id, id);
  }

  @Post('lessons/:id/upload-url')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Get a presigned PUT URL + object key for direct video upload' })
  uploadLessonUrl(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: LessonUploadUrlDto,
  ) {
    return this.courses.resolveLessonUploadTarget(tenant.id, id, dto);
  }

  @Post('lessons/:id/upload')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Upload a lesson video through the server (fallback when presigned PUT is unavailable)' })
  uploadLesson(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: LessonUploadDto,
  ) {
    return this.courses.uploadLessonVideoServer(tenant.id, id, dto.file, dto.filename);
  }

  // --- Curriculum reorder ---
  @Post(':slug/curriculum/reorder')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Persist the order of sections and lessons' })
  reorderCurriculum(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() dto: ReorderCurriculumDto,
  ) {
    return this.courses.reorderCurriculum(tenant.id, slug, dto);
  }
}
