import { Injectable, NotFoundException, Optional, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { enrollments, lessonProgress, lessonQuizAttempts } from '../../database/schema/progress';
import { lessons, courses } from '../../database/schema/courses';
import { getRequiredQuizIds, parseContentDocumentOrLegacy } from '../courses/lesson-content';
import { eq, and } from 'drizzle-orm';
import { CertificationService } from '../certification/certification.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    private drizzle: DrizzleService,
    @Optional() private certification?: CertificationService,
    @Optional() private notifications?: NotificationsService,
  ) {}

  async getEnrollment(userId: string, courseId: string) {
    return this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
  }

  async getLessonProgress(userId: string, lessonId: string, tenantId?: string) {
    return this.drizzle.db.query.lessonProgress.findFirst({
      where: tenantId
        ? and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.tenantId, tenantId))
        : and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)),
    });
  }

  async updateLessonProgress(
    userId: string,
    lessonId: string,
    tenantId: string,
    data: { watchTimeSeconds?: number; completed?: boolean; quizScore?: number },
  ) {
    const lesson = await this.drizzle.db.query.lessons.findFirst({
      where: and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)),
      columns: { id: true, contentBlocks: true, videoUrl: true, content: true, thumbnailUrl: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const document = parseContentDocumentOrLegacy(lesson.contentBlocks, lesson);
    const requiredQuizIds = getRequiredQuizIds(document);
    const attempts = await this.drizzle.db
      .select({ quizId: lessonQuizAttempts.quizId, score: lessonQuizAttempts.score, passed: lessonQuizAttempts.passed })
      .from(lessonQuizAttempts)
      .where(and(
        eq(lessonQuizAttempts.tenantId, tenantId),
        eq(lessonQuizAttempts.userId, userId),
        eq(lessonQuizAttempts.lessonId, lessonId),
      ));
    const passedQuizIds = new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.quizId));
    const allRequiredPassed = requiredQuizIds.length === 0 || requiredQuizIds.every((quizId) => passedQuizIds.has(quizId));
    const existing = await this.getLessonProgress(userId, lessonId, tenantId);
    const completed = requiredQuizIds.length > 0
      ? allRequiredPassed
      : data.completed === undefined
        ? Boolean(existing?.completed)
        : Boolean(data.completed);
    const patch: Record<string, unknown> = {
      completed,
      quizScore: Math.max(Number(existing?.quizScore ?? 0), ...attempts.map((attempt) => Number(attempt.score) || 0), 0),
      updatedAt: new Date(),
    };
    if (data.watchTimeSeconds !== undefined) patch.watchTimeSeconds = data.watchTimeSeconds;
    let result: any;
    if (existing) {
      const [row] = await this.drizzle.db
        .update(lessonProgress)
        .set({ ...patch, completedAt: completed ? (existing.completedAt ?? new Date()) : existing.completedAt } as any)
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      result = row ? [row] : [];
    } else {
      result = await this.drizzle.db
        .insert(lessonProgress)
        .values({ userId, lessonId, tenantId, ...patch, completedAt: completed ? new Date() : null } as any)
        .returning();
    }

    let completedCourseId: string | undefined;
    if (completed && this.certification) {
      try {
        const lessonContext = await this.drizzle.db.query.lessons.findFirst({
          where: and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)),
          with: { series: { columns: { courseId: true } } },
        });
        const courseId = (lessonContext as any)?.series?.courseId as string | undefined;
        completedCourseId = courseId;
        if (courseId) {
          const course = await this.drizzle.db.query.courses.findFirst({
            where: eq(courses.id, courseId),
            with: { series: { with: { lessons: { columns: { id: true } } } } },
          });
          if (course) {
            const allIds: string[] = [];
            for (const section of (course.series as any) || []) for (const item of section.lessons || []) allIds.push(item.id);
            if (allIds.length > 0) {
              const progress = await this.drizzle.db
                .select({ lessonId: lessonProgress.lessonId })
                .from(lessonProgress)
                .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)));
              const completedIds = progress.filter((item) => allIds.includes(item.lessonId)).map((item) => item.lessonId);
              if (completedIds.length === allIds.length) {
                void this.notifications?.notifyUser({
                  tenantId,
                  userId,
                  type: 'course_completed',
                  category: 'learning',
                  title: 'Course completed',
                  body: 'You completed all lessons in this course.',
                  entityType: 'course',
                  entityId: courseId,
                  idempotencyKey: `course-completed:${tenantId}:${userId}:${courseId}`,
                }).catch(() => {});
                const outcome = await this.certification
                  .tryAutoIssue(userId, courseId, tenantId)
                  .catch((error: any) => {
                    // Issuance failing must not fail the learner's progress
                    // update, but it must not vanish either: a silent catch
                    // here is how a broken certificate path went unnoticed.
                    this.logger?.error?.(
                      `Auto-issue failed for user=${userId} course=${courseId}: ${error?.message}`,
                    );
                    return null;
                  });
                if (outcome && outcome.status === 'skipped') {
                  this.logger?.warn?.(
                    `Auto-issue skipped for user=${userId} course=${courseId}: ${outcome.reason}`,
                  );
                }
              }
            }
          }
        }
      } catch (error: any) {
        this.logger?.error?.(
          `Course completion side-effects failed for user=${userId} ` +
            `course=${completedCourseId ?? 'unknown'}: ${error?.message}`,
        );
      }
    }

    return result;
  }
}
