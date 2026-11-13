import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

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

  /*
   * `POST /progress/lesson` was removed. It recorded completion with no enrollment check, so a
   * learner could complete every lesson of a paid course and get its certificate auto-issued.
   * Progress is recorded by `POST /courses/progress` (CoursesService.upsertProgress),
   * which checks enrollment and required quizzes; nothing in the app used this route.
   */
}
