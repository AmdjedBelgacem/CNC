import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsInt, Min, Max, IsBoolean, IsNumber } from 'class-validator';
import { ProgressService } from './progress.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

class UpdateLessonProgressDto {
  @IsUUID() lessonId!: string;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(360000) watchTimeSeconds?: number;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) quizScore?: number;
}

@ApiTags('progress')
@Controller('progress')
export class ProgressController {
  constructor(private progress: ProgressService) {}

  @Get(':courseId')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get enrollment progress for a course' })
  getEnrollment(
    @CurrentUser() user: { id: string },
    @Param('courseId') courseId: string,
  ) {
    return this.progress.getEnrollment(user.id, courseId);
  }

  @Post('lesson')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update lesson progress (tenant from auth, not body)' })
  updateLessonProgress(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: { id: string },
    @Body() body: UpdateLessonProgressDto,
  ) {
    if ((body as any).tenantId && String((body as any).tenantId) !== String(tenant.id)) {
      throw new ForbiddenException('Tenant mismatch');
    }
    return this.progress.updateLessonProgress(user.id, body.lessonId, tenant.id, body);
  }
}
