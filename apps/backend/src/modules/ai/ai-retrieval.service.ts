import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { aiDocumentChunks, aiDocuments } from '../../database/schema/ai';
import { courses, lessons, series } from '../../database/schema/courses';
import { enrollments } from '../../database/schema/progress';
import { AiProviderError, AiProviderService } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import { normalizeArabicText, sanitizeUserText } from './ai-safety.service';
import type { AiPageContext, AiProviderRuntimeConfig, AiRetrievedChunk, AiViewer } from './ai.types';

const ARABIC_SEARCH_ALIASES: Record<string, readonly string[]> = {
  تيتانيوم: ['titanium'],
  سبيائك: ['superalloys'],
  فولاذ: ['steel'],
  صلب: ['steel'],
  منيوم: ['aluminum', 'aluminium'],
  نحاس: ['copper'],
  تصنيع: ['manufacturing', 'machining'],
  تشغيل: ['operation', 'operating'],
  آلة: ['machine'],
  آلات: ['machine', 'machines'],
  ادوات: ['tools', 'tooling'],
  اداه: ['tool', 'tooling'],
  عدد: ['tools', 'tooling'],
  قواطع: ['cutting', 'inserts'],
  قاطع: ['cutting', 'insert'],
  سرعات: ['speeds', 'feeds'],
  سرعه: ['speed', 'speeds'],
  تغذيه: ['feed', 'feeds'],
  تبريد: ['coolant', 'cooling'],
  تخطيط: ['planning', 'setup'],
  اعداد: ['setup', 'preparation'],
  تجهيز: ['setup', 'workholding'],
  تثبيت: ['workholding', 'clamping'],
  امان: ['safety'],
  سلامه: ['safety'],
  صيانه: ['maintenance'],
  ماده: ['material'],
  مواد: ['materials'],
  معدن: ['metal'],
  معادن: ['metals'],
  مقاسات: ['dimensions', 'measurements'],
  قياس: ['measurement', 'measurements'],
  هندسه: ['geometry'],
  زوايا: ['angles', 'geometry'],
  تروس: ['gears'],
  محور: ['axis'],
  محاور: ['axes', 'axis'],
  تحكم: ['control', 'controls'],
  عداد: ['meter', 'gauges'],
  قطر: ['diameter'],
  طول: ['length'],
  عرض: ['width'],
  ارتفاع: ['height'],
  زمن: ['cycle time', 'time'],
  دوره: ['cycle', 'cycle time'],
  اختبار: ['test', 'testing'],
  معيار: ['standard', 'standards'],
  جوده: ['quality'],
  حاسوب: ['computer', 'cnc'],
  رقمي: ['numerical', 'digital'],
};

export function expandArabicSearchTerms(query: string): string[] {
  const normalized = normalizeArabicText(query);
  const terms = normalized.match(/[\p{L}\p{N}]{2,}/gu) || [];
  const aliases = terms.flatMap((term) => {
    const base = term.startsWith('ال') ? term.slice(2) : term;
    return ARABIC_SEARCH_ALIASES[base] || [];
  });
  return Array.from(new Set(aliases)).slice(0, 20);
}

@Injectable()
export class AiRetrievalService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly settings: AiSettingsService,
    private readonly provider: AiProviderService,
  ) {}

  async retrieve(
    tenantId: string,
    query: string,
    viewer: AiViewer | null,
    topK: number,
    minScore: number,
    runtime?: AiProviderRuntimeConfig,
  ): Promise<AiRetrievedChunk[]> {
    const normalizedQuery = sanitizeUserText(query, 2000);
    if (!normalizedQuery) return [];
    const limit = Math.min(Math.max(Math.floor(topK), 1), 50);
    const threshold = Math.min(Math.max(Number(minScore), 0), 1);
    if (viewer?.id && viewer.tenantId && String(viewer.tenantId) !== String(tenantId)) {
      throw new ForbiddenException('Tenant access denied');
    }
    const permission = await this.permissionCondition(tenantId, viewer);
    let results: AiRetrievedChunk[] = [];
    if (!runtime) {
      try {
        runtime = await this.settings.getRuntimeConfig(tenantId);
      } catch {
        runtime = undefined;
      }
    }
    if (runtime?.embeddingModel) {
      try {
        results = await this.embeddingRetrieve(tenantId, normalizedQuery, permission, limit, threshold, runtime);
      } catch (error) {
        if (!(error instanceof AiProviderError)) throw error;
      }
    }
    if (results.length < limit) {
      const keyword = await this.keywordRetrieve(tenantId, normalizedQuery, permission, limit, threshold);
      const merged = new Map(results.map((item) => [item.chunkId, item]));
      for (const item of keyword) merged.set(item.chunkId, item);
      results = Array.from(merged.values()).sort((a, b) => b.score - a.score).slice(0, limit);
    }
    return results;
  }

  private async permissionCondition(tenantId: string, viewer: AiViewer | null) {
    const liveFreePreview = sql`EXISTS (
      SELECT 1
      FROM lessons live_lesson
      JOIN series live_series ON live_series.id = live_lesson.series_id
      JOIN courses live_course ON live_course.id = live_series.course_id
      WHERE live_lesson.id = ${aiDocumentChunks.lessonId}
        AND live_lesson.tenant_id = ${aiDocumentChunks.tenantId}
        AND live_lesson.is_published = true
        AND live_lesson.is_archived = false
        AND live_lesson.free_preview = true
        AND live_series.is_published = true
        AND live_series.is_archived = false
        AND live_course.is_published = true
        AND live_course.is_archived = false
    )`;
    const publicCondition = or(
      and(
        ne(aiDocumentChunks.audience, 'free-preview'),
        eq(aiDocumentChunks.audience, 'public'),
        sql`NOT (${aiDocumentChunks.sourceType} = 'lesson' AND ${aiDocumentChunks.sourceId} LIKE '%:body')`,
      ),
      and(
        eq(aiDocumentChunks.sourceType, 'lesson'),
        sql`${aiDocumentChunks.sourceId} LIKE '%:body'`,
        liveFreePreview,
        or(eq(aiDocumentChunks.audience, 'public'), eq(aiDocumentChunks.audience, 'free-preview')),
      ),
    );
    if (!viewer?.id) return publicCondition;
    if (!viewer.tenantId) return publicCondition;
    if (
      String(viewer.tenantId || '') === String(tenantId) &&
      ['super_admin', 'admin'].includes(viewer.role || '')
    ) {
      return or(publicCondition, eq(aiDocumentChunks.audience, 'enrolled'), eq(aiDocumentChunks.audience, 'admin'));
    }
    const rows = await this.drizzle.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.userId, viewer.id),
        ne(enrollments.status, 'cancelled'),
      ));
    const courseIds = Array.from(new Set(rows.map((row) => row.courseId)));
    if (courseIds.length === 0) return publicCondition;
    return or(
      publicCondition,
      and(eq(aiDocumentChunks.audience, 'enrolled'), inArray(aiDocumentChunks.courseId, courseIds)),
    );
  }

  async retrieveLessonContext(
    tenantId: string,
    context: AiPageContext,
    viewer: AiViewer | null,
    topK: number,
  ): Promise<AiRetrievedChunk[]> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.courseId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.lessonId)) {
      return [];
    }
    await this.assertPageContextAccess(tenantId, context, viewer);
    const permission = await this.permissionCondition(tenantId, viewer);
    const rows = await this.drizzle.db
      .select({
        chunkId: aiDocumentChunks.id,
        documentId: aiDocumentChunks.documentId,
        content: aiDocumentChunks.content,
        title: aiDocumentChunks.title,
        href: aiDocumentChunks.href,
        sourceType: aiDocumentChunks.sourceType,
        sourceId: aiDocumentChunks.sourceId,
        courseId: aiDocumentChunks.courseId,
        lessonId: aiDocumentChunks.lessonId,
      })
      .from(aiDocumentChunks)
      .innerJoin(aiDocuments, and(
        eq(aiDocuments.id, aiDocumentChunks.documentId),
        eq(aiDocuments.tenantId, aiDocumentChunks.tenantId),
        eq(aiDocuments.status, 'active'),
      ))
      .where(and(
        eq(aiDocumentChunks.tenantId, tenantId),
        eq(aiDocumentChunks.courseId, context.courseId),
        eq(aiDocumentChunks.lessonId, context.lessonId),
        permission,
      ))
      .limit(Math.min(Math.max(topK, 1), 20));
    return rows.map((row) => this.toResult(row, 1));
  }

  private async assertPageContextAccess(
    tenantId: string,
    context: AiPageContext,
    viewer: AiViewer | null,
  ): Promise<void> {
    const rows = await this.drizzle.db
      .select({
        freePreview: lessons.freePreview,
        lessonPublished: lessons.isPublished,
        lessonArchived: lessons.isArchived,
        seriesPublished: series.isPublished,
        seriesArchived: series.isArchived,
        coursePublished: courses.isPublished,
        courseArchived: courses.isArchived,
      })
      .from(lessons)
      .innerJoin(series, and(eq(series.id, lessons.seriesId), eq(series.tenantId, tenantId)))
      .innerJoin(courses, and(eq(courses.id, series.courseId), eq(courses.tenantId, tenantId)))
      .where(and(
        eq(lessons.id, context.lessonId),
        eq(lessons.tenantId, tenantId),
        eq(courses.id, context.courseId),
      ))
      .limit(1);
    const row = rows[0];
    if (!row || !row.lessonPublished || row.lessonArchived || !row.seriesPublished || row.seriesArchived || !row.coursePublished || row.courseArchived) {
      throw new NotFoundException('Lesson context not found');
    }
    if (row.freePreview) return;
    if (!viewer?.id) throw new ForbiddenException('Lesson access required');
    if (viewer.tenantId && String(viewer.tenantId) !== String(tenantId)) {
      throw new ForbiddenException('Tenant access denied');
    }
    if (['super_admin', 'admin'].includes(viewer.role || '')) return;
    const enrollment = await this.drizzle.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.userId, viewer.id),
        eq(enrollments.courseId, context.courseId),
        ne(enrollments.status, 'cancelled'),
      ))
      .limit(1);
    if (enrollment.length === 0) throw new ForbiddenException('Lesson access required');
  }

  private async keywordRetrieve(
    tenantId: string,
    query: string,
    permission: ReturnType<AiRetrievalService['permissionCondition']> extends Promise<infer T> ? T : never,
    topK: number,
    minScore: number,
  ): Promise<AiRetrievedChunk[]> {
    const normalizedQuery = normalizeArabicText(query);
    const terms = Array.from(new Set(normalizedQuery.match(/[\p{L}\p{N}]{2,}/gu) || [])).slice(0, 12);
    const translatedTerms = expandArabicSearchTerms(normalizedQuery);
    if (terms.length === 0 && translatedTerms.length === 0) return [];
    const tsQuery = sql`plainto_tsquery('simple', ${normalizedQuery})`;
    const rank = sql<number>`ts_rank_cd(to_tsvector('simple', coalesce(${aiDocumentChunks.content}, '')), ${tsQuery})`;
    const matches = [
      sql`${aiDocumentChunks.content} @@ ${tsQuery}`,
      sql`${aiDocumentChunks.title} ILIKE ${`%${normalizedQuery}%`}`,
      ...terms.map((term) => sql`${aiDocumentChunks.content} ILIKE ${`%${term}%`}`),
      ...translatedTerms.flatMap((term) => [
        sql`${aiDocumentChunks.content} ILIKE ${`%${term}%`}`,
        sql`${aiDocumentChunks.title} ILIKE ${`%${term}%`}`,
      ]),
    ];
    const rows = await this.drizzle.db
      .select({
        chunkId: aiDocumentChunks.id,
        documentId: aiDocumentChunks.documentId,
        content: aiDocumentChunks.content,
        title: aiDocumentChunks.title,
        href: aiDocumentChunks.href,
        sourceType: aiDocumentChunks.sourceType,
        sourceId: aiDocumentChunks.sourceId,
        courseId: aiDocumentChunks.courseId,
        lessonId: aiDocumentChunks.lessonId,
        rank,
      })
      .from(aiDocumentChunks)
      .innerJoin(aiDocuments, and(
        eq(aiDocuments.id, aiDocumentChunks.documentId),
        eq(aiDocuments.tenantId, aiDocumentChunks.tenantId),
        eq(aiDocuments.status, 'active'),
      ))
      .where(and(eq(aiDocumentChunks.tenantId, tenantId), permission, or(...matches)))
      .orderBy(desc(rank))
      .limit(Math.min(Math.max(topK * 8, 40), 200));
    return rows
      .map((row) => {
        const haystack = `${row.title} ${row.content}`.toLowerCase();
        const originalMatched = terms.filter((term) => haystack.includes(term)).length;
        const translatedMatched = translatedTerms.filter((term) => haystack.includes(term)).length;
        const originalScore = originalMatched / Math.max(1, terms.length);
        const translatedScore = translatedMatched / Math.max(1, translatedTerms.length);
        const score = Math.min(1, Math.max(originalScore, translatedScore) + Number(row.rank || 0) * 0.15);
        return this.toResult(row, score);
      })
      .filter((row) => row.score >= minScore)
      .slice(0, topK);
  }

  private async embeddingRetrieve(
    tenantId: string,
    query: string,
    permission: ReturnType<AiRetrievalService['permissionCondition']> extends Promise<infer T> ? T : never,
    topK: number,
    minScore: number,
    runtime: AiProviderRuntimeConfig,
  ): Promise<AiRetrievedChunk[]> {
    const [queryVector] = await this.provider.embed({
      baseUrl: runtime.embeddingBaseUrl || runtime.baseUrl,
      apiKey: runtime.apiKey,
      model: runtime.embeddingModel!,
      inputs: [query],
      timeoutMs: runtime.timeoutMs,
    });
    if (!queryVector || queryVector.length === 0) return [];
    const rows = await this.drizzle.db
      .select({
        chunkId: aiDocumentChunks.id,
        documentId: aiDocumentChunks.documentId,
        content: aiDocumentChunks.content,
        title: aiDocumentChunks.title,
        href: aiDocumentChunks.href,
        sourceType: aiDocumentChunks.sourceType,
        sourceId: aiDocumentChunks.sourceId,
        courseId: aiDocumentChunks.courseId,
        lessonId: aiDocumentChunks.lessonId,
        embedding: aiDocumentChunks.embedding,
      })
      .from(aiDocumentChunks)
      .innerJoin(aiDocuments, and(
        eq(aiDocuments.id, aiDocumentChunks.documentId),
        eq(aiDocuments.tenantId, aiDocumentChunks.tenantId),
        eq(aiDocuments.status, 'active'),
      ))
      .where(and(
        eq(aiDocumentChunks.tenantId, tenantId),
        permission,
        isNotNull(aiDocumentChunks.embedding),
        eq(aiDocumentChunks.embeddingModel, runtime.embeddingModel!),
      ))
      .limit(500);
    return rows
      .map((row) => this.toResult(row, this.cosine(queryVector, row.embedding || [])))
      .filter((row) => row.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private toResult(
    row: {
      chunkId: string;
      documentId: string;
      content: string;
      title: string;
      href: string;
      sourceType: string;
      sourceId: string;
      courseId: string | null;
      lessonId: string | null;
    },
    score: number,
  ): AiRetrievedChunk {
    return {
      chunkId: row.chunkId,
      documentId: row.documentId,
      content: row.content,
      score: Math.max(0, Math.min(1, score)),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: row.title,
      href: row.href,
      courseId: row.courseId,
      lessonId: row.lessonId,
    };
  }

  private cosine(left: number[], right: number[]): number {
    if (left.length !== right.length || left.length === 0) return 0;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
      const a = left[index]!;
      const b = right[index]!;
      dot += a * b;
      leftNorm += a * a;
      rightNorm += b * b;
    }
    if (leftNorm === 0 || rightNorm === 0) return 0;
    return dot / Math.sqrt(leftNorm * rightNorm);
  }
}
