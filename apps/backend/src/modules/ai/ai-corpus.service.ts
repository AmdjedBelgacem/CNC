import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, gte, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { academies } from '../../database/schema/academies';
import { aiDocumentChunks, aiDocuments, type AiPermissionMetadata } from '../../database/schema/ai';
import { courses, lessons, series } from '../../database/schema/courses';
import { events } from '../../database/schema/events';
import { pages, pageVersions } from '../../database/schema/pages';
import { posts } from '../../database/schema/posts';
import { productsBundle } from '../../database/schema/products';
import { tenants } from '../../database/schema/tenants';
import { AiAuditService } from './ai-audit.service';
import { AiProviderService } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import { sanitizePublicText } from './ai-safety.service';
import type { AiDocumentInput } from './ai.types';
import { extractLessonBlockText, extractTranslationText, parseContentDocumentOrLegacy } from '../courses/lesson-content';
import { createHash } from 'node:crypto';

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;
const MAX_DOCUMENT_CHARS = 100000;
const TEXT_KEYS = /^(text|title|heading|subtitle|description|answer|label|value|wordmark|tagline|content|body|copy|caption|note|trustnote|name|eyebrow|accenttext|suffixtext|quote|kicker)$/i;
const SKIP_KEYS = /(?:href|src|url|uri|image|video|media|attachment|metadata|password|passcode|secret|token|credential|email|phone|address|class|style|color|icon|id|key|cookie|session|auth)/i;

export interface AiCorpusStats {
  documents: number;
  chunks: number;
  embeddedChunks: number;
}

@Injectable()
export class AiCorpusService {
  private readonly reindexRuns = new Map<string, Promise<AiCorpusStats>>();

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly settings: AiSettingsService,
    private readonly provider: AiProviderService,
    private readonly audit: AiAuditService,
  ) {}

  @Cron('0 */15 * * * *')
  async scheduledReindex(): Promise<void> {
    const activeTenants = await this.drizzle.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true));
    for (const tenant of activeTenants) {
      try {
        await this.reindexTenant(tenant.id);
      } catch {
        continue;
      }
    }
  }

  async extractTenantDocuments(tenantId: string): Promise<AiDocumentInput[]> {
    const tenant = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const documents: AiDocumentInput[] = [];
    const academyRows = await this.drizzle.db
      .select()
      .from(academies)
      .where(and(eq(academies.tenantId, tenantId), eq(academies.isPublished, true), eq(academies.isArchived, false)));
    for (const row of academyRows) {
      this.addDocument(documents, {
        sourceType: 'academy',
        sourceId: row.id,
        title: row.title,
        href: this.sourceUrl(tenant, `/academy/${encodeURIComponent(row.slug)}`),
        content: this.compose(row.title, row.subtitle, row.description),
        audience: 'public',
        sourceUpdatedAt: this.dateValue(row.updatedAt, row.publishedAt, row.createdAt),
        permissionMetadata: {},
      });
    }

    const courseRows = await this.drizzle.db
      .select()
      .from(courses)
      .where(and(eq(courses.tenantId, tenantId), eq(courses.isPublished, true), eq(courses.isArchived, false)));
    const courseById = new Map(courseRows.map((row) => [row.id, row]));
    for (const row of courseRows) {
      this.addDocument(documents, {
        sourceType: 'course',
        sourceId: row.id,
        title: row.title,
        href: this.sourceUrl(tenant, `/courses/${encodeURIComponent(row.slug)}`),
        content: this.compose(row.title, row.subtitle, row.description, extractTranslationText(row.translations)),
        audience: 'public',
        courseId: row.id,
        sourceUpdatedAt: this.dateValue(row.updatedAt, row.publishedAt, row.createdAt),
        permissionMetadata: {
          courseId: row.id,
          accessMode: row.accessMode || 'open',
          enrollmentRequired: row.accessMode !== 'open',
        },
      });
    }

    const seriesRows = await this.drizzle.db
      .select()
      .from(series)
      .where(and(eq(series.tenantId, tenantId), eq(series.isPublished, true), eq(series.isArchived, false)));
    const seriesById = new Map<string, { row: typeof series.$inferSelect; course: typeof courses.$inferSelect }>();
    for (const row of seriesRows) {
      const course = courseById.get(row.courseId);
      if (!course) continue;
      seriesById.set(row.id, { row, course });
      this.addDocument(documents, {
        sourceType: 'series',
        sourceId: row.id,
        title: row.title,
        href: this.sourceUrl(tenant, `/courses/${encodeURIComponent(course.slug)}`),
        content: this.compose(row.title, row.description, extractTranslationText(row.translations)),
        audience: 'public',
        courseId: course.id,
        sourceUpdatedAt: this.dateValue(row.updatedAt),
        permissionMetadata: {
          courseId: course.id,
          accessMode: course.accessMode || 'open',
          enrollmentRequired: course.accessMode !== 'open',
        },
      });
    }

    const lessonRows = await this.drizzle.db
      .select()
      .from(lessons)
      .where(and(eq(lessons.tenantId, tenantId), eq(lessons.isPublished, true), eq(lessons.isArchived, false)));
    for (const row of lessonRows) {
      const parent = seriesById.get(row.seriesId);
      if (!parent) continue;
      const lessonDocument = parseContentDocumentOrLegacy(row.contentBlocks, row);
      const blockBody = extractLessonBlockText(lessonDocument, {
        includeQuizPrompts: true,
        includeGated: false,
        includeTranslations: true,
      });
      const lessonBody = sanitizePublicText(this.compose(row.content, blockBody, extractTranslationText(row.translations)), 80000);
      const metadata = this.compose(row.title, row.description, extractTranslationText(row.translations));
      const href = this.sourceUrl(tenant, `/courses/${encodeURIComponent(parent.course.slug)}/lessons/${encodeURIComponent(row.slug)}`);
      this.addDocument(documents, {
        sourceType: 'lesson',
        sourceId: `${row.id}:metadata`,
        title: row.title,
        href,
        content: metadata,
        audience: 'public',
        courseId: parent.course.id,
        lessonId: row.id,
        sourceUpdatedAt: this.dateValue(row.updatedAt),
        permissionMetadata: {
          courseId: parent.course.id,
          lessonId: row.id,
          accessMode: parent.course.accessMode || 'open',
          freePreview: !!row.freePreview,
          bodyIncluded: false,
          enrollmentRequired: !row.freePreview,
        },
      });
      if (lessonBody) {
        this.addDocument(documents, {
          sourceType: 'lesson',
          sourceId: `${row.id}:body`,
          title: row.title,
          href,
          content: lessonBody,
          audience: row.freePreview ? 'free-preview' : 'enrolled',
          courseId: parent.course.id,
          lessonId: row.id,
          sourceUpdatedAt: this.dateValue(row.updatedAt),
          permissionMetadata: {
            courseId: parent.course.id,
            lessonId: row.id,
            accessMode: parent.course.accessMode || 'open',
            freePreview: !!row.freePreview,
            bodyIncluded: true,
            enrollmentRequired: !row.freePreview,
          },
        });
      }
    }

    const productRows = await this.drizzle.db
      .select()
      .from(productsBundle)
      .where(and(
        eq(productsBundle.tenantId, tenantId),
        eq(productsBundle.isPublished, true),
        eq(productsBundle.isArchived, false),
      ));
    for (const row of productRows) {
      const features = Array.isArray(row.features) ? row.features.filter((value): value is string => typeof value === 'string') : [];
      const courseId = row.courseId && courseById.has(row.courseId) ? row.courseId : null;
      this.addDocument(documents, {
        sourceType: 'product',
        sourceId: row.id,
        title: row.title,
        href: this.sourceUrl(tenant, `/products/${encodeURIComponent(row.slug)}`),
        content: this.compose(row.title, row.tagline, row.description, ...features),
        audience: 'public',
        courseId,
        sourceUpdatedAt: this.dateValue(row.updatedAt, row.createdAt),
        permissionMetadata: courseId ? { courseId } : {},
      });
    }

    const eventRows = await this.drizzle.db
      .select()
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.isPublished, true)));
    for (const row of eventRows) {
      const eventMeta = [
        row.eventType ? `Event type: ${row.eventType}` : '',
        row.startDate ? `Starts: ${new Date(row.startDate).toISOString()}` : '',
      ];
      this.addDocument(documents, {
        sourceType: 'event',
        sourceId: row.id,
        title: row.title,
        href: this.sourceUrl(tenant, `/events/${encodeURIComponent(row.slug)}`),
        content: this.compose(row.title, row.description, ...eventMeta),
        audience: 'public',
        sourceUpdatedAt: this.dateValue(row.updatedAt, row.createdAt),
        permissionMetadata: {},
      });
    }

    const postRows = await this.drizzle.db
      .select()
      .from(posts)
      .where(and(eq(posts.tenantId, tenantId), eq(posts.isPublic, true)));
    for (const row of postRows) {
      this.addDocument(documents, {
        sourceType: 'post',
        sourceId: row.id,
        title: 'Community post',
        href: this.sourceUrl(tenant, `/feed?post=${encodeURIComponent(row.id)}`),
        content: sanitizePublicText(row.content, 20000),
        audience: 'public',
        sourceUpdatedAt: this.dateValue(row.updatedAt, row.createdAt),
        permissionMetadata: {},
      });
    }

    const pageRows = await this.drizzle.db
      .select()
      .from(pages)
      .where(and(
        eq(pages.tenantId, tenantId),
        eq(pages.status, 'published'),
        gte(pages.version, 1),
      ));
    const pageIds = pageRows.map((row) => row.id);
    const snapshotRows = pageIds.length > 0
      ? await this.drizzle.db
        .select()
        .from(pageVersions)
        .where(and(
          eq(pageVersions.tenantId, tenantId),
          inArray(pageVersions.pageId, pageIds),
          eq(pageVersions.status, 'published'),
        ))
      : [];
    const snapshots = new Map(snapshotRows.map((row) => [`${row.pageId}:${row.version}`, row]));
    for (const page of pageRows) {
      const snapshot = snapshots.get(`${page.id}:${page.version}`);
      if (!snapshot) continue;
      const text = this.extractLayoutText(snapshot.layout);
      this.addDocument(documents, {
        sourceType: 'page',
        sourceId: page.id,
        title: page.title,
        href: this.sourceUrl(tenant, this.pagePath(page.slug)),
        content: this.compose(page.title, text),
        audience: 'public',
        sourceUpdatedAt: this.dateValue(snapshot.createdAt, page.publishedAt, page.updatedAt),
        permissionMetadata: { pageVersion: snapshot.version },
      });
    }

    return documents;
  }

  async upsertDocument(tenantId: string, input: AiDocumentInput): Promise<{ documentId: string; chunkCount: number }> {
    const content = sanitizePublicText(input.content, MAX_DOCUMENT_CHARS);
    if (!content) throw new BadRequestException('Document content is empty');
    const title = sanitizePublicText(input.title, 500) || 'Untitled';
    const href = this.safeHref(input.href);
    const permissionMetadata = this.safePermissionMetadata(input.permissionMetadata);
    const sourceUpdatedAt = input.sourceUpdatedAt || new Date();
    const contentHash = createHash('sha256').update(content).digest('hex');
    const now = new Date();
    const existing = await this.drizzle.db.query.aiDocuments.findFirst({
      where: and(
        eq(aiDocuments.tenantId, tenantId),
        eq(aiDocuments.sourceType, input.sourceType),
        eq(aiDocuments.sourceId, input.sourceId),
      ),
    });
    const chunks = deterministicChunkText(content);
    let documentId = existing?.id;
    const chunksChanged = !existing ||
      existing.contentHash !== contentHash ||
      existing.title !== title ||
      existing.href !== href ||
      existing.audience !== input.audience ||
      String(existing.courseId || '') !== String(input.courseId || '') ||
      String(existing.lessonId || '') !== String(input.lessonId || '') ||
      JSON.stringify(existing.permissionMetadata || {}) !== JSON.stringify(permissionMetadata);
    if (existing) {
      await this.drizzle.db
        .update(aiDocuments)
        .set({
          title,
          href,
          content,
          audience: input.audience,
          courseId: input.courseId || null,
          lessonId: input.lessonId || null,
          permissionMetadata,
          sourceUpdatedAt,
          contentHash,
          status: 'active',
          updatedAt: now,
        })
        .where(eq(aiDocuments.id, existing.id));
    } else {
      const [created] = await this.drizzle.db
        .insert(aiDocuments)
        .values({
          tenantId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title,
          href,
          content,
          audience: input.audience,
          courseId: input.courseId || null,
          lessonId: input.lessonId || null,
          permissionMetadata,
          sourceUpdatedAt,
          contentHash,
          status: 'active',
        })
        .returning({ id: aiDocuments.id });
      documentId = created?.id;
    }
    if (!documentId) throw new Error('Failed to store AI document');
    if (chunksChanged) {
      await this.drizzle.db
        .delete(aiDocumentChunks)
        .where(and(eq(aiDocumentChunks.tenantId, tenantId), eq(aiDocumentChunks.documentId, documentId)));
      if (chunks.length > 0) {
        await this.drizzle.db.insert(aiDocumentChunks).values(chunks.map((chunk, chunkIndex) => ({
          tenantId,
          documentId,
          chunkIndex,
          content: chunk,
          audience: input.audience,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title,
          href,
          courseId: input.courseId || null,
          lessonId: input.lessonId || null,
          permissionMetadata,
          sourceUpdatedAt,
        })));
      }
    } else {
      const existingChunks = await this.drizzle.db
        .select({ id: aiDocumentChunks.id })
        .from(aiDocumentChunks)
        .where(and(eq(aiDocumentChunks.tenantId, tenantId), eq(aiDocumentChunks.documentId, documentId)));
      if (existingChunks.length !== chunks.length) {
        await this.drizzle.db
          .delete(aiDocumentChunks)
          .where(and(eq(aiDocumentChunks.tenantId, tenantId), eq(aiDocumentChunks.documentId, documentId)));
        if (chunks.length > 0) {
          await this.drizzle.db.insert(aiDocumentChunks).values(chunks.map((chunk, chunkIndex) => ({
            tenantId,
            documentId,
            chunkIndex,
            content: chunk,
            audience: input.audience,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            title,
            href,
            courseId: input.courseId || null,
            lessonId: input.lessonId || null,
            permissionMetadata,
            sourceUpdatedAt,
          })));
        }
      }
    }
    return { documentId, chunkCount: chunks.length };
  }

  async deleteSource(tenantId: string, sourceType: string, sourceId: string): Promise<void> {
    await this.drizzle.db
      .delete(aiDocuments)
      .where(and(
        eq(aiDocuments.tenantId, tenantId),
        eq(aiDocuments.sourceType, sourceType),
        eq(aiDocuments.sourceId, sourceId),
      ));
  }

  async reindexTenant(tenantId: string, context: { userId?: string } = {}): Promise<AiCorpusStats> {
    const current = this.reindexRuns.get(tenantId);
    if (current) return current;
    const run = this.reindexTenantInternal(tenantId, context);
    this.reindexRuns.set(tenantId, run);
    try {
      return await run;
    } finally {
      if (this.reindexRuns.get(tenantId) === run) this.reindexRuns.delete(tenantId);
    }
  }

  private async reindexTenantInternal(tenantId: string, context: { userId?: string } = {}): Promise<AiCorpusStats> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new BadRequestException('Invalid tenant');
    }
    const tenant = await this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Tenant not found or inactive');
    try {
      const inputs = await this.extractTenantDocuments(tenantId);
      const existing = await this.drizzle.db
        .select({ id: aiDocuments.id, sourceType: aiDocuments.sourceType, sourceId: aiDocuments.sourceId })
        .from(aiDocuments)
        .where(eq(aiDocuments.tenantId, tenantId));
      const activeKeys = new Set(inputs.map((input) => `${input.sourceType}:${input.sourceId}`));
      let chunkCount = 0;
      for (const input of inputs) {
        const result = await this.upsertDocument(tenantId, input);
        chunkCount += result.chunkCount;
      }
      for (const row of existing) {
        if (!activeKeys.has(`${row.sourceType}:${row.sourceId}`)) {
          await this.drizzle.db.delete(aiDocuments).where(and(eq(aiDocuments.tenantId, tenantId), eq(aiDocuments.id, row.id)));
        }
      }
      const embeddedChunks = await this.populateEmbeddings(tenantId);
      const stats = { documents: inputs.length, chunks: chunkCount, embeddedChunks };
      await this.settings.recordIndexResult(tenantId, stats);
      await this.audit.event(tenantId, 'ai.corpus.reindex', 'success', context, 'ai_corpus', tenantId, stats);
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'reindex_failed';
      await this.settings.recordIndexResult(tenantId, { documents: 0, chunks: 0, embeddedChunks: 0 }, message);
      await this.audit.event(tenantId, 'ai.corpus.reindex', 'error', context, 'ai_corpus', tenantId, { error: message });
      throw error;
    }
  }

  async stats(tenantId: string): Promise<AiCorpusStats> {
    const [documents, chunks, embedded] = await Promise.all([
      this.drizzle.db.select({ id: aiDocuments.id }).from(aiDocuments).where(eq(aiDocuments.tenantId, tenantId)),
      this.drizzle.db.select({ id: aiDocumentChunks.id }).from(aiDocumentChunks).where(eq(aiDocumentChunks.tenantId, tenantId)),
      this.drizzle.db.select({ id: aiDocumentChunks.id }).from(aiDocumentChunks).where(and(eq(aiDocumentChunks.tenantId, tenantId), isNotNull(aiDocumentChunks.embedding))),
    ]);
    return { documents: documents.length, chunks: chunks.length, embeddedChunks: embedded.length };
  }

  private async populateEmbeddings(tenantId: string): Promise<number> {
    let runtime: Awaited<ReturnType<AiSettingsService['getRuntimeConfig']>>;
    try {
      runtime = await this.settings.getRuntimeConfig(tenantId);
    } catch {
      return 0;
    }
    if (!runtime.embeddingModel) return 0;
    const pending = await this.drizzle.db
      .select({ id: aiDocumentChunks.id, content: aiDocumentChunks.content })
      .from(aiDocumentChunks)
      .where(and(
        eq(aiDocumentChunks.tenantId, tenantId),
        or(
          isNull(aiDocumentChunks.embedding),
          isNull(aiDocumentChunks.embeddingModel),
          ne(aiDocumentChunks.embeddingModel, runtime.embeddingModel),
        ),
      ))
      .limit(512);
    let embedded = 0;
    for (let offset = 0; offset < pending.length; offset += 16) {
      const batch = pending.slice(offset, offset + 16);
      try {
        const vectors = await this.provider.embed({
          baseUrl: runtime.embeddingBaseUrl || runtime.baseUrl,
          apiKey: runtime.apiKey,
          model: runtime.embeddingModel,
          inputs: batch.map((row) => row.content),
          timeoutMs: runtime.timeoutMs,
        });
        for (let index = 0; index < batch.length; index += 1) {
          await this.drizzle.db
            .update(aiDocumentChunks)
            .set({ embedding: vectors[index], embeddingModel: runtime.embeddingModel, embeddingUpdatedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(aiDocumentChunks.tenantId, tenantId), eq(aiDocumentChunks.id, batch[index]!.id)));
          embedded += 1;
        }
      } catch {
        break;
      }
    }
    return embedded;
  }

  private addDocument(documents: AiDocumentInput[], input: AiDocumentInput): void {
    const normalized: AiDocumentInput = {
      ...input,
      title: sanitizePublicText(input.title, 500) || 'Untitled',
      content: sanitizePublicText(input.content, MAX_DOCUMENT_CHARS),
      href: this.safeHref(input.href),
    };
    if (normalized.content) documents.push(normalized);
  }

  private compose(...values: Array<string | null | undefined>): string {
    return sanitizePublicText(values.filter((value): value is string => !!value).join('\n'), MAX_DOCUMENT_CHARS);
  }

  private safeHref(value: string): string {
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\u0000-\u001f\u007f]/.test(value)) {
      return value.slice(0, 1000);
    }
    return '/';
  }

  private sourceUrl(_tenant: { domain: string | null }, path: string): string {
    return path;
  }

  private pagePath(slug: string): string {
    const paths: Record<string, string> = {
      home: '/',
      'academy-landing': '/academy',
      products: '/products',
      feed: '/feed',
      events: '/events',
    };
    return paths[slug] || `/${encodeURIComponent(slug)}`;
  }

  private dateValue(...values: Array<Date | string | null | undefined>): Date {
    for (const value of values) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
    return new Date();
  }

  private safePermissionMetadata(value: Record<string, unknown> | undefined): AiPermissionMetadata {
    const output: AiPermissionMetadata = {};
    if (!value || typeof value !== 'object') return output;
    for (const key of ['courseId', 'lessonId', 'accessMode', 'freePreview', 'bodyIncluded', 'enrollmentRequired', 'pageVersion']) {
      const item = value[key];
      if (typeof item === 'string' && item.length <= 255) (output as Record<string, unknown>)[key] = item;
      if (typeof item === 'boolean') (output as Record<string, unknown>)[key] = item;
      if (typeof item === 'number' && Number.isFinite(item)) (output as Record<string, unknown>)[key] = item;
    }
    return output;
  }

  private extractLayoutText(layout: unknown): string {
    const output: string[] = [];
    let count = 0;
    const walk = (value: unknown, key = '', depth = 0): void => {
      if (count >= 1200 || depth > 10) return;
      if (typeof value === 'string') {
        if (TEXT_KEYS.test(key) && !SKIP_KEYS.test(key)) {
          const text = sanitizePublicText(value, 3000);
          if (text) output.push(text);
          count += 1;
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item, key, depth + 1);
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [childKey, childValue] of Object.entries(value)) {
        if (SKIP_KEYS.test(childKey)) continue;
        walk(childValue, childKey, depth + 1);
      }
    };
    walk(layout);
    return output.join('\n');
  }
}

export function deterministicChunkText(value: string, maxChars = CHUNK_SIZE, overlapChars = CHUNK_OVERLAP): string[] {
  const safeMaxChars = Math.max(1, Math.floor(maxChars));
  const safeOverlapChars = Math.max(0, Math.min(Math.floor(overlapChars), safeMaxChars - 1));
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const words = normalized.split(' ');
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const word of words) {
    const nextLength = length + (current.length > 0 ? 1 : 0) + word.length;
    if (current.length > 0 && nextLength > safeMaxChars) {
      chunks.push(current.join(' '));
      const overlap: string[] = [];
      let overlapLength = 0;
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const candidate = current[index]!;
        const candidateLength = overlapLength + (overlap.length > 0 ? 1 : 0) + candidate.length;
        if (candidateLength > safeOverlapChars) break;
        overlap.unshift(candidate);
        overlapLength = candidateLength;
      }
      current = overlap;
      length = overlapLength;
    }
    const next = length + (current.length > 0 ? 1 : 0) + word.length;
    if (next > safeMaxChars && word.length > safeMaxChars) {
      for (let offset = 0; offset < word.length; offset += safeMaxChars) chunks.push(word.slice(offset, offset + safeMaxChars));
      current = [];
      length = 0;
      continue;
    }
    current.push(word);
    length = next;
  }
  if (current.length > 0) chunks.push(current.join(' '));
  return chunks;
}
