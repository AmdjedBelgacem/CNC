import { Injectable, Optional, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { enrollments, lessonProgress } from '../../database/schema/progress';
import { lessons, courses } from '../../database/schema/courses';
import { eq, and } from 'drizzle-orm';
import { CertificationService } from '../certification/certification.service';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  constructor(
    private drizzle: DrizzleService,
    @Optional() private certification?: CertificationService,
  ) {}

  async getEnrollment(userId: string, courseId: string) {
    return this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
  }

  async getLessonProgress(userId: string, lessonId: string) {
    return this.drizzle.db.query.lessonProgress.findFirst({
      where: and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)),
    });
  }

  async updateLessonProgress(
    userId: string,
    lessonId: string,
    tenantId: string,
    data: { watchTimeSeconds?: number; completed?: boolean; quizScore?: number },
  ) {
    const existing = await this.getLessonProgress(userId, lessonId);
    let result: any;
    if (existing) {
      const [row] = await this.drizzle.db
        .update(lessonProgress)
        .set({ ...data, updatedAt: new Date(), completedAt: data.completed ? new Date() : existing.completedAt } as any)
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      result = row ? [row] : [];
    } else {
      result = await this.drizzle.db
        .insert(lessonProgress)
        .values({ userId, lessonId, tenantId, ...data, completedAt: data.completed ? new Date() : null } as any)
        .returning();
    }

    if (data.completed && this.certification) {
      try {
        const lesson = await this.drizzle.db.query.lessons.findFirst({
          where: eq(lessons.id, lessonId),
          with: { series: { columns: { courseId: true } } },
        });
        const courseId = (lesson as any)?.series?.courseId as string | undefined;
        if (courseId) {
          // Check if course is now completed - count lessons vs completed
          const course = await this.drizzle.db.query.courses.findFirst({
            where: eq(courses.id, courseId),
            with: { series: { with: { lessons: { columns: { id: true } } } } },
          });
          if (course) {
            const allIds: string[] = [];
            for (const s of (course.series as any) || []) for (const l of s.lessons || []) allIds.push(l.id);
            if (allIds.length > 0) {
              const progress = await this.drizzle.db
                .select({ lessonId: lessonProgress.lessonId })
                .from(lessonProgress)
                .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)));
              const completedIds = progress.filter((p) => allIds.includes(p.lessonId)).map((p) => p.lessonId);
              if (completedIds.length === allIds.length) {
                await this.certification.tryAutoIssue(userId, courseId, tenantId).catch((e) => {
                  this.logger.warn(`Auto-issue failed for user=${userId} course=${courseId}: ${e?.message}`);
                });
              }
            }
          }
        }
      } catch {}
    }

    return result;
  }
}
