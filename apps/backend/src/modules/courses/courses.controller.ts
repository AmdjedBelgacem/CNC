import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateCourseDto, CreateSeriesDto, CreateLessonDto,
  CourseFilterDto, UpdateProgressDto, EnrollDto,
} from './dto/courses.dto';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Public()
  @TenantScoped()
  @Get()
  @ApiOperation({ summary: 'List courses with filters' })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query() filters?: CourseFilterDto,
  ) {
    return this.courses.findByTenant(tenant.id, filters);
  }

  @Public()
  @TenantScoped()
  @Get(':slug')
  @ApiOperation({ summary: 'Get course detail with series and lessons' })
  findBySlug(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.findBySlug(tenant.id, slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a course' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateCourseDto,
  ) {
    return this.courses.createCourse(tenant.id, dto);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a course' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() dto: Partial<CreateCourseDto>,
  ) {
    return this.courses.updateCourse(tenant.id, slug, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a course' })
  delete(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.deleteCourse(tenant.id, slug);
  }

  @Post(':slug/publish')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Publish a course' })
  publish(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.publishCourse(tenant.id, slug);
  }

  @Post(':slug/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Unpublish a course' })
  unpublish(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.unpublishCourse(tenant.id, slug);
  }

  @Post(':slug/archive')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Archive a course' })
  archive(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.archiveCourse(tenant.id, slug);
  }

  @Post(':slug/restore')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Restore an archived course' })
  restore(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.restoreCourse(tenant.id, slug);
  }

  // --- Curriculum ---
  @Post(':slug/curriculum/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Reorder curriculum (series and lessons)' })
  reorderCurriculum(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() dto: { series: { id: string; sortOrder: number }[]; lessons: { id: string; seriesId: string; sortOrder: number }[] },
  ) {
    return this.courses.reorderCurriculum(tenant.id, slug, dto);
  }

  // --- Series ---
  @Post('series')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a series' })
  createSeries(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateSeriesDto,
  ) {
    return this.courses.createSeries(tenant.id, dto);
  }

  @Public()
  @TenantScoped()
  @Get(':courseSlug/series/:seriesSlug')
  @ApiOperation({ summary: 'Get series detail within course' })
  findSeries(
    @CurrentTenant() tenant: { id: string },
    @Param('courseSlug') courseSlug: string,
    @Param('seriesSlug') seriesSlug: string,
  ) {
    return this.courses.findSeries(tenant.id, courseSlug, seriesSlug);
  }

  @Patch('series/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a series' })
  updateSeries(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateSeriesDto>,
  ) {
    return this.courses.updateSeries(tenant.id, id, dto);
  }

  // --- Lessons ---
  @Post('lessons')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a lesson' })
  createLesson(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateLessonDto,
  ) {
    return this.courses.createLesson(tenant.id, dto);
  }

  @Public()
  @TenantScoped()
  @Get('lessons/:slug')
  @ApiOperation({ summary: 'Get lesson with series + course context (video redacted unless freePreview)' })
  findLesson(
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.courses.findLessonFull(tenant.id, slug);
  }

  @Public()
  @TenantScoped()
  @Get(':courseSlug/lessons/:lessonSlug')
  @ApiOperation({ summary: 'Get lesson by course and lesson slug (video redacted unless freePreview)' })
  findLessonInCourse(
    @CurrentTenant() tenant: { id: string },
    @Param('courseSlug') courseSlug: string,
    @Param('lessonSlug') lessonSlug: string,
  ) {
    return this.courses.findLessonInCourse(tenant.id, courseSlug, lessonSlug);
  }

  // Public (optional auth): freePreview lessons play without login.
  // Non-preview lessons still require admin/enrollment inside the service.
  @Public()
  @TenantScoped()
  @Get('lessons/:slug/playback')
  @UseGuards(OptionalAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get signed playback URL (freePreview public; others paywalled)' })
  getLessonPlayback(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string; role: string; tenantId: string } | null,
    @Param('slug') slug: string,
  ) {
    return this.courses.getLessonPlaybackUrl(tenant.id, slug, user);
  }

  @Public()
  @TenantScoped()
  @Get(':courseSlug/lessons/:lessonSlug/playback')
  @UseGuards(OptionalAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get signed playback URL scoped to course (freePreview public)' })
  getLessonPlaybackInCourse(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string; role: string; tenantId: string } | null,
    @Param('courseSlug') courseSlug: string,
    @Param('lessonSlug') lessonSlug: string,
  ) {
    return this.courses.getLessonPlaybackUrl(tenant.id, lessonSlug, user, courseSlug);
  }

  @Patch('lessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantScopeGuard)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a lesson' })
  updateLesson(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateLessonDto>,
  ) {
    return this.courses.updateLesson(tenant.id, id, dto);
  }

  // --- Enrollments ---
  @Post('enroll')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Enroll in a course' })
  enroll(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: EnrollDto,
  ) {
    return this.courses.enrollUser(tenant.id, user.id, dto.courseId);
  }

  @Get('enrollments/mine')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get my enrollments with progress' })
  myEnrollments(@CurrentUser() user: { id: string }) {
    return this.courses.getUserEnrollments(user.id);
  }

  // --- Progress ---
  @Get(':courseId/progress')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiOperation({ summary: 'Get course progress for current user' })
  courseProgress(
    @CurrentUser() user: { id: string },
    @Param('courseId') courseId: string,
  ) {
    return this.courses.getCourseProgress(user.id, courseId);
  }

  @Post('progress')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert lesson progress (watch time, complete)' })
  updateProgress(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProgressDto,
  ) {
    return this.courses.upsertProgress(user.id, dto.lessonId, tenant.id, {
      watchTimeSeconds: dto.watchTimeSeconds,
      completed: dto.completed,
      quizScore: dto.quizScore,
    });
  }
}
