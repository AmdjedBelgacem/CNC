import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { ConfigService } from '../../config/config.service';
import { users } from '../../database/schema/users';
import { academies } from '../../database/schema/academies';
import { courses, lessons, series } from '../../database/schema/courses';
import { productsBundle } from '../../database/schema/products';
import { posts } from '../../database/schema/posts';
import { events } from '../../database/schema/events';
import { pages } from '../../database/schema/pages';
import { orders } from '../../database/schema/orders';
import { certifications } from '../../database/schema/certifications';
import { AiCorpusService } from '../ai/ai-corpus.service';
import { extractLessonBlockText, extractTranslationText, parseContentDocumentOrLegacy } from '../courses/lesson-content';
import { PublicCacheService } from '../../common/cache/public-cache.service';

export type SearchScope = 'public' | 'admin';
export type SearchSort = 'relevance' | 'title' | 'newest';
export type SearchResultType =
  | 'academy'
  | 'course'
  | 'series'
  | 'lesson'
  | 'product'
  | 'post'
  | 'event'
  | 'user'
  | 'page'
  | 'order'
  | 'certificate';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  imageUrl?: string | null;
  score?: number;
  meta?: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
  counts: Partial<Record<SearchResultType, number>>;
  types: SearchResultType[];
  engine: 'postgres' | 'meilisearch' | 'postgres-fallback';
}

export interface SearchOptions {
  scope?: SearchScope;
  types?: string | string[];
  limit?: number;
  page?: number;
  sort?: SearchSort;
}

interface SearchCandidate extends SearchResultItem {
  tenantId: string;
  documentId: string;
  publicVisible: boolean;
  adminVisible: boolean;
  body: string;
  updatedAt: string | null;
}

interface Batch<T> {
  items: T[];
  total: number;
}

interface MeiliIndex {
  getStats(): Promise<{ numberOfDocuments: number }>;
  updateSettings(settings: Record<string, unknown>): Promise<unknown>;
  search<T>(query: string, options: Record<string, unknown>): Promise<{
    hits: T[];
    estimatedTotalHits?: number;
    facetDistribution?: Record<string, Record<string, number>>;
  }>;
  addDocuments(documents: SearchDocument[]): Promise<unknown>;
  deleteDocument(id: string): Promise<unknown>;
}

interface MeiliClient {
  health(): Promise<unknown>;
  index(name: string): MeiliIndex;
  /** Primary key is declared here: the document shape has several `*id` fields, so
   * Meili cannot infer it and refuses the whole batch without it. */
  createIndex(uid: string, options: { primaryKey: string }): Promise<unknown>;
}

type MeiliConstructor = new (options: { host: string; apiKey?: string }) => MeiliClient;
type DynamicImport = (specifier: string) => Promise<unknown>;
const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

interface SearchDocument extends SearchCandidate {
  entityId: string;
}

const PUBLIC_TYPES: SearchResultType[] = [
  'academy',
  'course',
  'series',
  'lesson',
  'product',
  'post',
  'event',
  'user',
  'page',
];

const ADMIN_TYPES: SearchResultType[] = [
  ...PUBLIC_TYPES,
  'order',
  'certificate',
];

const ALL_TYPES = new Set<SearchResultType>(ADMIN_TYPES);
const AI_SYNC_TYPES = new Set<SearchResultType>(['academy', 'course', 'series', 'lesson', 'product', 'post', 'event', 'page']);
const STATIC_DOCS = [
  { id: 'static:about', slug: 'about', title: 'About TITANS', subtitle: 'Our manufacturing community' },
  { id: 'static:privacy', slug: 'privacy', title: 'Privacy Policy', subtitle: 'How your data is handled' },
  { id: 'static:terms', slug: 'terms', title: 'Terms of Service', subtitle: 'Platform terms' },
  { id: 'static:refunds', slug: 'refunds', title: 'Refunds', subtitle: 'Refund and return policy' },
];
const TYPE_ALIASES: Record<string, SearchResultType> = {
  academy: 'academy',
  academies: 'academy',
  course: 'course',
  courses: 'course',
  series: 'series',
  lesson: 'lesson',
  lessons: 'lesson',
  product: 'product',
  products: 'product',
  post: 'post',
  posts: 'post',
  event: 'event',
  events: 'event',
  user: 'user',
  users: 'user',
  people: 'user',
  page: 'page',
  pages: 'page',
  order: 'order',
  orders: 'order',
  certificate: 'certificate',
  certificates: 'certificate',
};

const MAX_QUERY_LENGTH = 200;
const MAX_FALLBACK_CANDIDATES = 2000;
const MEILI_RETRY_MS = 30_000;
const MEILI_TIMEOUT_MS = 700;

function normalizeQuery(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function contains(column: unknown, value: string) {
  return sql`${column} ILIKE ${`%${escapeLike(value)}%`} ESCAPE '\\'`;
}

function jsonContains(column: unknown, value: string) {
  return sql`${column}::text ILIKE ${`%${escapeLike(value)}%`} ESCAPE '\\'`;
}

function toCount(value: unknown) {
  return Number(value ?? 0) || 0;
}

function normalizeTypes(value: string | string[] | undefined, scope: SearchScope) {
  const allowed = scope === 'public' ? PUBLIC_TYPES : ADMIN_TYPES;
  const values = Array.isArray(value) ? value : value ? value.split(',') : [];
  const types = values
    .map((item) => TYPE_ALIASES[String(item).trim().toLowerCase()])
    .filter((item): item is SearchResultType => !!item && allowed.includes(item));
  return [...new Set(types.length ? types : allowed)];
}

function safeHref(value: string | null | undefined, fallback: string) {
  const candidate = String(value ?? '').trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  return candidate;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scoreCandidate(candidate: SearchCandidate, query: string) {
  const needle = query.toLocaleLowerCase();
  const title = candidate.title.toLocaleLowerCase();
  const subtitle = (candidate.subtitle ?? '').toLocaleLowerCase();
  const body = candidate.body.toLocaleLowerCase();
  const tokens = needle.split(/\s+/).filter(Boolean);
  let score = 0;
  if (title === needle) score += 1000;
  else if (title.startsWith(needle)) score += 800;
  else if (title.includes(needle)) score += 650;
  if (subtitle.includes(needle)) score += 250;
  if (body.includes(needle)) score += 100;
  for (const token of tokens) {
    if (title.includes(token)) score += 80;
    else if (subtitle.includes(token)) score += 35;
    else if (body.includes(token)) score += 15;
  }
  return score;
}

function publicResult(candidate: SearchCandidate): SearchResultItem {
  return {
    type: candidate.type,
    id: candidate.id,
    title: candidate.title,
    subtitle: candidate.subtitle ?? null,
    href: candidate.href,
    imageUrl: candidate.imageUrl ?? null,
    score: candidate.score,
    meta: candidate.meta,
  };
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private meiliClient: MeiliClient | null = null;
  private meiliState: 'unknown' | 'up' | 'down' = 'unknown';
  private meiliCheckedAt = 0;
  private meiliSettingsReady = false;
  private readonly aiReindexTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
    private readonly aiCorpus: AiCorpusService,
    @Optional() private readonly publicCache?: PublicCacheService,
  ) {}

  async search(query: string, tenantId: string, options: SearchOptions = {}) {
    const scope = options.scope ?? 'admin';
    return this.execute(normalizeQuery(query), tenantId, scope, options);
  }

  async searchPublic(query: string, tenantId: string, options: Omit<SearchOptions, 'scope'> = {}) {
    return this.execute(normalizeQuery(query), tenantId, 'public', options);
  }

  async searchAdmin(query: string, tenantId: string, options: Omit<SearchOptions, 'scope'> = {}) {
    return this.execute(normalizeQuery(query), tenantId, 'admin', options);
  }

  async suggest(query: string, tenantId: string, options: Omit<SearchOptions, 'scope'> = {}) {
    return this.searchPublic(query, tenantId, { ...options, limit: Math.min(options.limit ?? 8, 12), page: 1 });
  }

  async reindexTenant(tenantId: string) {
    if (!tenantId) throw new ServiceUnavailableException('Tenant is required');
    const client = await this.getMeiliClient();
    if (!client) throw new ServiceUnavailableException('Meilisearch is unavailable');
    const index = client.index('titan_search');
    await this.prepareMeiliIndex(index);
    const candidates = await this.collectCandidates(tenantId, 'admin', ADMIN_TYPES, MAX_FALLBACK_CANDIDATES);
    const documents = candidates.map((candidate) => this.toDocument(candidate));
    if (documents.length) await index.addDocuments(documents);
    return { engine: 'meilisearch' as const, indexed: documents.length, tenantId };
  }

  async indexEntity(tenantId: string, type: SearchResultType, id: string) {
    if (AI_SYNC_TYPES.has(type)) this.scheduleAiReindex(tenantId);
    try {
      const client = await this.getMeiliClient();
      if (!client) return;
      const index = client.index('titan_search');
      await this.prepareMeiliIndex(index);
      const candidates = await this.collectCandidates(tenantId, 'admin', [type], MAX_FALLBACK_CANDIDATES);
      const candidate = candidates.find((item) => item.id === id);
      if (candidate) await index.addDocuments([this.toDocument(candidate)]);
      else await index.deleteDocument(this.documentId(tenantId, type, id));
    } catch (error) {
      this.logger.warn(`Search index update failed for ${type}:${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeEntity(tenantId: string, type: SearchResultType, id: string) {
    if (AI_SYNC_TYPES.has(type)) this.scheduleAiReindex(tenantId);
    try {
      const client = await this.getMeiliClient();
      if (!client) return;
      const index = client.index('titan_search');
      await this.prepareMeiliIndex(index);
      await index.deleteDocument(this.documentId(tenantId, type, id));
    } catch (error) {
      this.logger.warn(`Search index removal failed for ${type}:${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private scheduleAiReindex(tenantId: string): void {
    const current = this.aiReindexTimers.get(tenantId);
    if (current) clearTimeout(current);
    const timer = setTimeout(() => {
      this.aiReindexTimers.delete(tenantId);
      void this.aiCorpus.reindexTenant(tenantId).catch((error: unknown) => {
        this.logger.warn(`AI corpus update failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, 1500);
    timer.unref?.();
    this.aiReindexTimers.set(tenantId, timer);
  }

  private async execute(
    query: string,
    tenantId: string,
    scope: SearchScope,
    options: SearchOptions,
  ): Promise<SearchResponse> {
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(options.limit) || 20)));
    const types = normalizeTypes(options.types, scope);
    const sort = options.sort ?? 'relevance';
    if (!tenantId || !query) {
      return this.emptyResponse(query, page, pageSize, types);
    }

    /**
     * Short-TTL cache for search results.
     *
     * Load testing showed search to be the slowest public endpoint by a wide margin (1.86 s
     * p95) and the reason was not Meilisearch: when it is unavailable every query falls
     * back to `collectCandidates`, which reads a large slice of the catalogue and ranks it
     * in process. That work is identical for every anonymous visitor asking the same
     * question, so it is cached on the same short TTL as the course endpoints.
     *
     * Keyed by tenant, scope, query, page, size, types and sort, so no result can cross a
     * tenant or a locale boundary.
     */
    const cacheKey = this.publicCache?.buildKey(`search:${scope}`, tenantId, undefined, {
      q: query,
      page,
      limit: pageSize,
      types: types.join(','),
      sort,
    });
    if (cacheKey) {
      const hit = await this.publicCache!.get<SearchResponse>(cacheKey);
      if (hit) return hit;
    }

    if (this.meiliState !== 'down') {
      const meili = await this.searchMeili(query, tenantId, scope, types, page, pageSize, sort);
      if (meili) {
        if (cacheKey) await this.publicCache!.set(cacheKey, meili);
        return meili;
      }
    }

    const candidates = await this.collectCandidates(tenantId, scope, types, MAX_FALLBACK_CANDIDATES, query);
    const ranked = candidates
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, query) }))
      .filter((candidate) => candidate.score > 0);
    ranked.sort((left, right) => {
      if (sort === 'title') return left.title.localeCompare(right.title);
      if (sort === 'newest') return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
      return (right.score ?? 0) - (left.score ?? 0) || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
    });
    const total = ranked.length;
    const offset = (page - 1) * pageSize;
    const pageItems = ranked.slice(offset, offset + pageSize);
    const counts: Partial<Record<SearchResultType, number>> = {};
    for (const candidate of ranked) counts[candidate.type] = (counts[candidate.type] ?? 0) + 1;
    const results = pageItems.map(publicResult);
    const response: SearchResponse = {
      query,
      results,
      items: results,
      total,
      page,
      pageSize,
      hasMore: offset + results.length < total,
      nextPage: offset + results.length < total ? page + 1 : null,
      counts,
      types,
      engine: this.meiliState === 'down' ? 'postgres-fallback' : 'postgres',
    };
    // Cache the fallback path too: it is the expensive one, since `collectCandidates`
    // re-reads and re-ranks the catalogue on every call when Meilisearch is down.
    if (cacheKey) await this.publicCache!.set(cacheKey, response);
    return response;
  }

  private emptyResponse(query: string, page: number, pageSize: number, types: SearchResultType[]): SearchResponse {
    return {
      query,
      results: [],
      items: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
      nextPage: null,
      counts: {},
      types,
      engine: 'postgres',
    };
  }

  private async searchMeili(
    query: string,
    tenantId: string,
    scope: SearchScope,
    types: SearchResultType[],
    page: number,
    pageSize: number,
    sort: SearchSort,
  ): Promise<SearchResponse | null> {
    const client = await this.getMeiliClient();
    if (!client) return null;
    try {
      const index = client.index('titan_search');
      await this.prepareMeiliIndex(index);
      const filters = [
        `tenantId = ${JSON.stringify(tenantId)}`,
        scope === 'public' ? 'publicVisible = true' : 'adminVisible = true',
        `type IN [${types.map((type) => JSON.stringify(type)).join(', ')}]`,
      ];
      const response = await index.search<SearchDocument>(query, {
        filter: filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sort: sort === 'relevance' ? undefined : sort === 'title' ? ['title:asc'] : ['updatedAt:desc'],
        attributesToRetrieve: ['entityId', 'type', 'title', 'subtitle', 'href', 'imageUrl', 'score', 'meta', 'updatedAt'],
      });
      if (!response.hits.length && response.estimatedTotalHits === 0) return null;
      const results = response.hits.map((hit) => ({
        type: hit.type,
        id: hit.entityId,
        title: hit.title,
        subtitle: hit.subtitle ?? null,
        href: safeHref(hit.href, '#'),
        imageUrl: hit.imageUrl ?? null,
        score: hit.score,
        meta: hit.meta,
      } satisfies SearchResultItem));
      const counts: Partial<Record<SearchResultType, number>> = {};
      for (const type of types) counts[type] = 0;
      if (response.facetDistribution?.type) {
        for (const [type, value] of Object.entries(response.facetDistribution.type)) {
          if (ALL_TYPES.has(type as SearchResultType)) counts[type as SearchResultType] = Number(value) || 0;
        }
      }
      return {
        query,
        results,
        items: results,
        total: response.estimatedTotalHits ?? results.length,
        page,
        pageSize,
        hasMore: (page * pageSize) < (response.estimatedTotalHits ?? results.length),
        nextPage: (page * pageSize) < (response.estimatedTotalHits ?? results.length) ? page + 1 : null,
        counts,
        types,
        engine: 'meilisearch',
      };
    } catch (error) {
      this.meiliState = 'down';
      this.meiliCheckedAt = Date.now();
      this.logger.warn(`Meilisearch query failed; using Postgres fallback: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async getMeiliClient() {
    const now = Date.now();
    if (this.meiliState === 'down' && now - this.meiliCheckedAt < MEILI_RETRY_MS) return null;
    if (this.meiliState === 'up' && this.meiliClient) return this.meiliClient;
    const host = this.config.get('MEILISEARCH_HOST');
    const apiKey = this.config.get('MEILISEARCH_API_KEY');
    if (!host) return null;
    try {
      const loaded = await dynamicImport('meilisearch') as { MeiliSearch?: MeiliConstructor; Meilisearch?: MeiliConstructor };
      const MeiliCtor = loaded.MeiliSearch ?? loaded.Meilisearch;
      if (!MeiliCtor) throw new Error('Meilisearch client export is unavailable');
      const client = this.meiliClient ?? new MeiliCtor({ host, apiKey });
      this.meiliClient = client;
      await Promise.race([
        client.health(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Meilisearch health timeout')), MEILI_TIMEOUT_MS)),
      ]);
      this.meiliState = 'up';
      this.meiliCheckedAt = now;
      return client;
    } catch (error) {
      this.meiliState = 'down';
      this.meiliCheckedAt = now;
      this.logger.warn(`Meilisearch unavailable; using Postgres search: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Ensures the index exists with a known primary key, then applies settings.
   *
   * `addDocuments` cannot infer a primary key here: the document shape has four fields
   * ending in `id` (`id`, `entityId`, `documentId`, and `tenantId` does not count but the
   * candidates carry others), so Meili fails the whole batch with
   * `index_primary_key_multiple_candidates_found` and the index silently stays empty.
   * The primary key must therefore be declared explicitly.
   */
  private async prepareMeiliIndex(index: MeiliIndex) {
    if (this.meiliSettingsReady) return;
    await this.ensureMeiliIndex(index);
    await index.updateSettings({
      searchableAttributes: ['title', 'subtitle', 'body'],
      filterableAttributes: ['tenantId', 'type', 'publicVisible', 'adminVisible'],
      sortableAttributes: ['title', 'updatedAt'],
      displayedAttributes: ['entityId', 'type', 'title', 'subtitle', 'href', 'imageUrl', 'score', 'meta', 'updatedAt', 'tenantId', 'publicVisible', 'adminVisible', 'body'],
    });
    this.meiliSettingsReady = true;
  }

  /** Create the index if it is absent, declaring the primary key Meili cannot infer. */
  private async ensureMeiliIndex(index: MeiliIndex) {
    try {
      await index.getStats();
    } catch {
      const client = await this.getMeiliClient();
      await client
        ?.createIndex('titan_search', { primaryKey: 'id' })
        .catch((error: unknown) => {
          // A concurrent boot may have created it first; that is success, not failure.
          this.logger.warn(
            `Meilisearch index creation reported: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
  }

  /**
   * Composite Meilisearch document id.
   *
   * Meilisearch restricts document identifiers to `[A-Za-z0-9_-]` (max 511 bytes). A `:`
   * separator makes every `addDocuments` call fail with `invalid_document_id`, which
   * leaves the index permanently empty while the API still reports `indexed: 150`.
   */
  private documentId(tenantId: string, type: SearchResultType, id: string) {
    const raw = `${tenantId}-${type}-${id}`;
    // Some candidate ids carry colons themselves (e.g. the static pages use
    // `static:about`), so sanitizing the separator alone is not enough.
    const safe = raw.replace(/[^A-Za-z0-9_-]/g, '_');
    // Meilisearch also caps identifiers at 511 bytes; keep the tail distinctive when
    // truncating so two long ids cannot collapse onto the same document.
    return safe.length <= 480 ? safe : `${safe.slice(0, 460)}_${this.shortHash(raw)}`;
  }

  private shortHash(value: string): string {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  private toDocument(candidate: SearchCandidate): SearchDocument {
    return {
      ...candidate,
      id: this.documentId(candidate.tenantId, candidate.type, candidate.id),
      entityId: candidate.id,
    };
  }

  private async collectCandidates(
    tenantId: string,
    scope: SearchScope,
    types: SearchResultType[],
    limit: number,
    query?: string,
  ): Promise<SearchCandidate[]> {
    const batches = await this.collectBatches(tenantId, scope, types, limit, query);
    return batches.flatMap((batch) => batch.items);
  }

  private async collectBatches(
    tenantId: string,
    scope: SearchScope,
    types: SearchResultType[],
    limit: number,
    query?: string,
  ): Promise<Batch<SearchCandidate>[]> {
    const tasks: Array<Promise<Batch<SearchCandidate>>> = [];
    if (types.includes('academy')) tasks.push(this.searchAcademies(tenantId, scope, limit, query));
    if (types.includes('course')) tasks.push(this.searchCourses(tenantId, scope, limit, query));
    if (types.includes('series')) tasks.push(this.searchSeries(tenantId, scope, limit, query));
    if (types.includes('lesson')) tasks.push(this.searchLessons(tenantId, scope, limit, query));
    if (types.includes('product')) tasks.push(this.searchProducts(tenantId, scope, limit, query));
    if (types.includes('post')) tasks.push(this.searchPosts(tenantId, scope, limit, query));
    if (types.includes('event')) tasks.push(this.searchEvents(tenantId, scope, limit, query));
    if (types.includes('user')) tasks.push(this.searchUsers(tenantId, scope, limit, query));
    if (types.includes('page')) tasks.push(this.searchPages(tenantId, scope, limit, query));
    if (scope === 'admin' && types.includes('order')) tasks.push(this.searchOrders(tenantId, limit, query));
    if (scope === 'admin' && types.includes('certificate')) tasks.push(this.searchCertificates(tenantId, limit, query));
    return Promise.all(tasks);
  }

  private async searchAcademies(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(academies.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(academies.isPublished, true), eq(academies.isArchived, false));
    if (query) conditions.push(or(contains(academies.title, query), contains(academies.subtitle, query), contains(academies.slug, query), contains(academies.description, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(academies).where(where).orderBy(asc(academies.title)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(academies).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'academy',
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        href: safeHref(`/academy/${this.segment(row.slug)}`, '/academy'),
        imageUrl: row.heroImageUrl,
        body: row.description ?? '',
        publicVisible: Boolean(row.isPublished && !row.isArchived),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { status: row.isPublished ? 'published' : 'draft' },
      })),
    };
  }

  private async searchCourses(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(courses.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(courses.isPublished, true), eq(courses.isArchived, false));
    if (query) conditions.push(or(contains(courses.title, query), contains(courses.subtitle, query), contains(courses.slug, query), contains(courses.description, query), contains(courses.seoTitle, query), contains(courses.seoDescription, query), jsonContains(courses.translations, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(courses).where(where).orderBy(asc(courses.title)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(courses).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'course',
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        href: safeHref(`/courses/${this.segment(row.slug)}`, '/courses'),
        imageUrl: row.thumbnailUrl,
        body: `${row.description ?? ''} ${extractTranslationText(row.translations)}`,
        publicVisible: Boolean(row.isPublished && !row.isArchived),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { status: row.isPublished ? 'published' : 'draft', archived: row.isArchived, slug: row.slug },
      })),
    };
  }

  private async searchSeries(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(series.tenantId, tenantId), eq(courses.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(series.isPublished, true), eq(series.isArchived, false), eq(courses.isPublished, true), eq(courses.isArchived, false));
    if (query) conditions.push(or(contains(series.title, query), contains(series.description, query), contains(series.slug, query), contains(courses.title, query), jsonContains(series.translations, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db
      .select({ row: series, course: { id: courses.id, slug: courses.slug, title: courses.title, isPublished: courses.isPublished, isArchived: courses.isArchived } })
      .from(series)
      .innerJoin(courses, eq(series.courseId, courses.id))
      .where(where)
      .orderBy(asc(series.title))
      .limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(series).innerJoin(courses, eq(series.courseId, courses.id)).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map(({ row, course }) => this.candidate({
        tenantId,
        type: 'series',
        id: row.id,
        title: row.title,
        subtitle: course.title,
        href: safeHref(`/courses/${this.segment(course.slug)}?series=${this.segment(row.slug)}`, `/courses/${this.segment(course.slug)}`),
        imageUrl: row.thumbnailUrl,
        body: `${row.description ?? ''} ${extractTranslationText(row.translations)}`,
        publicVisible: Boolean(row.isPublished && !row.isArchived && course.isPublished && !course.isArchived),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { courseId: course.id, courseSlug: course.slug, status: row.isPublished ? 'published' : 'draft' },
      })),
    };
  }

  private async searchLessons(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(lessons.tenantId, tenantId), eq(series.tenantId, tenantId), eq(courses.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(lessons.isPublished, true), eq(lessons.isArchived, false), eq(series.isPublished, true), eq(series.isArchived, false), eq(courses.isPublished, true), eq(courses.isArchived, false));
    if (query) {
      const blockCondition = scope === 'public'
        ? and(eq(lessons.freePreview, true), jsonContains(lessons.contentBlocks, query))
        : jsonContains(lessons.contentBlocks, query);
      conditions.push(or(contains(lessons.title, query), contains(lessons.description, query), contains(lessons.slug, query), contains(courses.title, query), contains(series.title, query), jsonContains(lessons.translations, query), blockCondition)!);
    }
    const where = and(...conditions);
    const rows = await this.drizzle.db
      .select({ row: lessons, series: { title: series.title, slug: series.slug, isPublished: series.isPublished, isArchived: series.isArchived }, course: { title: courses.title, slug: courses.slug, isPublished: courses.isPublished, isArchived: courses.isArchived } })
      .from(lessons)
      .innerJoin(series, eq(lessons.seriesId, series.id))
      .innerJoin(courses, eq(series.courseId, courses.id))
      .where(where)
      .orderBy(asc(lessons.title))
      .limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(lessons).innerJoin(series, eq(lessons.seriesId, series.id)).innerJoin(courses, eq(series.courseId, courses.id)).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map(({ row, series: parentSeries, course }) => {
        const document = parseContentDocumentOrLegacy(row.contentBlocks, row);
        const blockText = scope === 'public' && !row.freePreview
          ? ''
          : extractLessonBlockText(document, { includeQuizPrompts: true, includeGated: false, includeTranslations: true });
        return this.candidate({
          tenantId,
          type: 'lesson',
          id: row.id,
          title: row.title,
          subtitle: `${course.title} · ${parentSeries.title}`,
          href: safeHref(`/courses/${this.segment(course.slug)}/lessons/${this.segment(row.slug)}`, `/courses/${this.segment(course.slug)}`),
          imageUrl: row.thumbnailUrl,
          body: `${row.description ?? ''} ${extractTranslationText(row.translations)} ${blockText}`,
          publicVisible: Boolean(row.isPublished && !row.isArchived && parentSeries.isPublished && !parentSeries.isArchived && course.isPublished && !course.isArchived),
          adminVisible: true,
          updatedAt: dateValue(row.updatedAt),
          meta: { courseId: course.slug, courseSlug: course.slug, seriesSlug: parentSeries.slug, freePreview: row.freePreview, status: row.isPublished ? 'published' : 'draft' },
        });
      }),
    };
  }

  private async searchProducts(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(productsBundle.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(productsBundle.isPublished, true), eq(productsBundle.status, 'published'), eq(productsBundle.isArchived, false));
    if (query) conditions.push(or(contains(productsBundle.title, query), contains(productsBundle.tagline, query), contains(productsBundle.slug, query), contains(productsBundle.description, query), contains(productsBundle.category, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(productsBundle).where(where).orderBy(asc(productsBundle.title)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(productsBundle).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'product',
        id: row.id,
        title: row.title,
        subtitle: row.tagline,
        href: safeHref(`/products/${this.segment(row.slug)}`, '/products'),
        imageUrl: row.thumbnailUrl,
        body: `${row.description ?? ''} ${(row.tags ?? []).join(' ')}`,
        publicVisible: Boolean(row.isPublished && !row.isArchived),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { status: row.status, archived: row.isArchived, category: row.category },
      })),
    };
  }

  private async searchPosts(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(posts.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(posts.isPublic, true));
    if (query) conditions.push(or(contains(posts.content, query), sql`coalesce(array_to_string(${posts.tags}, ' '), '') ILIKE ${`%${escapeLike(query)}%`} ESCAPE '\\'`)!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(posts).where(where).orderBy(desc(posts.createdAt)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(posts).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'post',
        id: row.id,
        title: row.content.slice(0, 120) + (row.content.length > 120 ? '…' : ''),
        subtitle: (row.tags ?? []).join(' · ') || null,
        href: safeHref(`/feed?post=${row.id}`, '/feed'),
        imageUrl: row.mediaUrls?.[0],
        body: row.content,
        publicVisible: Boolean(row.isPublic),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { authorId: row.userId, likeCount: row.likeCount, commentCount: row.commentCount },
      })),
    };
  }

  private async searchEvents(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(events.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(events.isPublished, true));
    if (query) conditions.push(or(contains(events.title, query), contains(events.slug, query), contains(events.description, query), contains(events.eventType, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(events).where(where).orderBy(asc(events.startDate)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(events).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'event',
        id: row.id,
        title: row.title,
        subtitle: row.eventType,
        href: safeHref(`/events/${this.segment(row.slug)}`, '/events'),
        imageUrl: row.thumbnailUrl,
        body: row.description ?? '',
        publicVisible: Boolean(row.isPublished),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { startDate: dateValue(row.startDate), isVirtual: row.isVirtual },
      })),
    };
  }

  private async searchUsers(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(users.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(users.portfolioEnabled, true), eq(users.isActive, true), eq(users.accountStatus, 'active'), isNull(users.deletedAt));
    if (query) {
      const fields = scope === 'public'
        ? or(contains(users.name, query), contains(users.username, query), contains(users.headline, query), contains(users.bio, query))!
        : or(contains(users.name, query), contains(users.username, query), contains(users.email, query), contains(users.headline, query))!;
      conditions.push(fields);
    }
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(users).where(where).orderBy(asc(users.name)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(users).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'user',
        id: row.id,
        title: row.name || row.username || (scope === 'admin' ? row.email : 'User'),
        subtitle: scope === 'public' ? row.headline : row.email,
        href: safeHref(`/u/${this.segment(row.username ?? row.id)}`, `/profile/${row.id}`),
        imageUrl: row.avatarUrl,
        body: `${row.headline ?? ''} ${row.bio ?? ''}`,
        publicVisible: Boolean(row.portfolioEnabled && row.isActive && row.accountStatus === 'active' && !row.deletedAt),
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { username: row.username, role: row.role, accountStatus: row.accountStatus },
      })),
    };
  }

  private async searchPages(tenantId: string, scope: SearchScope, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(pages.tenantId, tenantId)];
    if (scope === 'public') conditions.push(eq(pages.status, 'published'), sql`${pages.version} > 0`);
    if (query) conditions.push(or(contains(pages.title, query), contains(pages.slug, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(pages).where(where).orderBy(asc(pages.title)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(pages).where(where);
    const staticMatches = STATIC_DOCS
      .filter((doc) => !query || `${doc.title} ${doc.subtitle} ${doc.slug}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map((doc) => this.candidate({
        tenantId,
        type: 'page',
        id: doc.id,
        title: doc.title,
        subtitle: doc.subtitle,
        href: `/${doc.slug}`,
        imageUrl: null,
        body: '',
        publicVisible: true,
        adminVisible: true,
        updatedAt: null,
        meta: { static: true, slug: doc.slug },
      }));
    return {
      total: toCount(countRow?.value) + staticMatches.length,
      items: [
        ...rows.map((row) => this.candidate({
          tenantId,
          type: 'page',
          id: row.id,
          title: row.title,
          subtitle: `/${row.slug}`,
          href: safeHref(row.slug === 'home' ? '/' : `/${this.segment(row.slug)}`, '/'),
          imageUrl: null,
          body: '',
          publicVisible: row.status === 'published' && row.version > 0,
          adminVisible: true,
          updatedAt: dateValue(row.updatedAt),
          meta: { slug: row.slug, status: row.status, version: row.version },
        })),
        ...staticMatches,
      ],
    };
  }

  private async searchOrders(tenantId: string, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(orders.tenantId, tenantId)];
    if (query) conditions.push(or(sql`${orders.id}::text ILIKE ${`%${escapeLike(query)}%`} ESCAPE '\\'`, contains(orders.status, query), contains(orders.stripeSessionId, query), contains(orders.stripePaymentIntentId, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(orders).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map((row) => this.candidate({
        tenantId,
        type: 'order',
        id: row.id,
        title: `Order ${row.id.slice(0, 8)}`,
        subtitle: row.status,
        href: safeHref(`/admin/finance?order=${row.id}`, '/admin/finance'),
        imageUrl: null,
        body: `${row.status} ${row.currency} ${row.total}`,
        publicVisible: false,
        adminVisible: true,
        updatedAt: dateValue(row.updatedAt),
        meta: { status: row.status, total: row.total, currency: row.currency, userId: row.userId },
      })),
    };
  }

  private async searchCertificates(tenantId: string, limit: number, query?: string): Promise<Batch<SearchCandidate>> {
    const conditions = [eq(certifications.tenantId, tenantId)];
    if (query) conditions.push(or(contains(certifications.certificateNumber, query), contains(users.name, query), contains(users.email, query), contains(courses.title, query))!);
    const where = and(...conditions);
    const rows = await this.drizzle.db
      .select({ cert: certifications, user: { name: users.name, email: users.email }, course: { title: courses.title, slug: courses.slug } })
      .from(certifications)
      .innerJoin(users, eq(certifications.userId, users.id))
      .innerJoin(courses, eq(certifications.courseId, courses.id))
      .where(where)
      .orderBy(desc(certifications.issuedAt))
      .limit(limit);
    const [countRow] = await this.drizzle.db.select({ value: count() }).from(certifications).innerJoin(users, eq(certifications.userId, users.id)).innerJoin(courses, eq(certifications.courseId, courses.id)).where(where);
    return {
      total: toCount(countRow?.value),
      items: rows.map(({ cert, user, course }) => this.candidate({
        tenantId,
        type: 'certificate',
        id: cert.id,
        title: `Certificate ${cert.certificateNumber}`,
        subtitle: `${user.name ?? user.email} · ${course.title}`,
        href: safeHref(`/admin/certificates?certificate=${cert.id}`, '/admin/certificates'),
        imageUrl: null,
        body: `${cert.certificateNumber} ${user.name ?? ''} ${user.email ?? ''} ${course.title ?? ''}`,
        publicVisible: false,
        adminVisible: true,
        updatedAt: dateValue(cert.issuedAt),
        meta: { certificateNumber: cert.certificateNumber, revoked: Boolean(cert.revokedAt), userId: cert.userId, courseId: cert.courseId },
      })),
    };
  }

  private segment(value: string | null | undefined) {
    return encodeURIComponent(String(value ?? ''));
  }

  private candidate(input: Omit<SearchCandidate, 'documentId' | 'score'> & { body: string }): SearchCandidate {
    return {
      ...input,
      id: input.id,
      documentId: this.documentId(input.tenantId, input.type, input.id),
      score: 0,
    };
  }
}
