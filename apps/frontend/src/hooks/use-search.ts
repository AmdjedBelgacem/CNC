'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { safeInternalHref } from '@/lib/safe-href';
import type {
  SearchResponse,
  SearchResultItem,
  SearchResultType,
} from '@/lib/api/types';

export type { SearchResponse, SearchResult, SearchResultItem, SearchResultType } from '@/lib/api/types';

export type SearchScope = 'public' | 'admin';
export type SearchSort = 'relevance' | 'title' | 'newest';

export interface SiteSearchOptions {
  enabled?: boolean;
  scope?: SearchScope;
  page?: number;
  limit?: number;
  type?: SearchResultType | 'all';
  sort?: SearchSort;
}

export interface NormalizedSearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasMore: boolean;
  nextPage: number | null;
  counts: Partial<Record<SearchResultType, number>>;
  types: SearchResultType[];
  engine: string | null;
  serverPaginated: boolean;
}

export interface SearchGroup {
  type: SearchResultType;
  items: SearchResultItem[];
}

export const SEARCH_RESULT_TYPES: SearchResultType[] = [
  'course',
  'series',
  'lesson',
  'product',
  'event',
  'post',
  'user',
  'academy',
  'page',
  'order',
  'certificate',
];

export const PUBLIC_SEARCH_RESULT_TYPES: SearchResultType[] = SEARCH_RESULT_TYPES.filter(
  (type) => type !== 'order' && type !== 'certificate',
);

export function searchResultTypesForScope(scope: SearchScope): SearchResultType[] {
  return scope === 'admin' ? SEARCH_RESULT_TYPES : PUBLIC_SEARCH_RESULT_TYPES;
}

const TYPE_ALIASES: Record<string, SearchResultType> = {
  course: 'course',
  courses: 'course',
  series: 'series',
  lesson: 'lesson',
  lessons: 'lesson',
  product: 'product',
  products: 'product',
  event: 'event',
  events: 'event',
  post: 'post',
  posts: 'post',
  user: 'user',
  users: 'user',
  person: 'user',
  people: 'user',
  academy: 'academy',
  academies: 'academy',
  page: 'page',
  pages: 'page',
  order: 'order',
  orders: 'order',
  certificate: 'certificate',
  certificates: 'certificate',
};

const TYPE_ORDER: SearchResultType[] = [
  'course',
  'series',
  'lesson',
  'product',
  'event',
  'post',
  'user',
  'academy',
  'page',
  'order',
  'certificate',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function normalizeType(value: unknown, fallback?: SearchResultType): SearchResultType | undefined {
  const text = asText(value)?.toLowerCase();
  if (text && TYPE_ALIASES[text]) return TYPE_ALIASES[text];
  return fallback;
}

function fallbackHref(
  record: Record<string, unknown>,
  type: SearchResultType,
  id: string,
): string | null {
  const slug = asText(record.slug) || asText(record.username) || id;
  const encoded = encodeURIComponent(slug);
  switch (type) {
    case 'course':
      return `/courses/${encoded}`;
    case 'series':
      return `/admin/courses?series=${encoded}`;
    case 'lesson':
      return `/admin/courses/lessons/${encoded}`;
    case 'product':
      return `/products/${encoded}`;
    case 'event':
      return `/events/${encoded}`;
    case 'post':
      return `/feed?post=${encoded}`;
    case 'user':
      return `/u/${encoded}`;
    case 'academy':
      return `/academy/${encoded}`;
    case 'page':
      return `/${encoded}`;
    case 'order':
      return `/admin/finance?order=${encoded}`;
    case 'certificate':
      return `/admin/certificates?certificate=${encoded}`;
  }
  return null;
}

function normalizeResult(value: unknown, typeHint?: SearchResultType): SearchResultItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const type = normalizeType(
    record.type ?? record.kind ?? record.entityType ?? record.resourceType ?? record.resultType,
    typeHint,
  );
  const id = asText(record.id ?? record.entityId ?? record.resultId);
  if (!type || !id) return null;
  const title = asText(record.title ?? record.name ?? record.label ?? record.content);
  if (!title) return null;
  const subtitle = asText(
    record.subtitle ?? record.description ?? record.tagline ?? record.headline ?? record.email,
  );
  const href = safeInternalHref(
    record.href ?? record.url ?? record.path ?? record.link ?? record.route,
    fallbackHref(record, type, id) ?? undefined,
  );
  if (!href) return null;
  return {
    type,
    id,
    title: title.length > 160 ? `${title.slice(0, 157)}…` : title,
    subtitle,
    href,
    imageUrl: asText(record.imageUrl ?? record.thumbnailUrl ?? record.avatarUrl),
    score: asNumber(record.score ?? record.relevance),
    meta: asRecord(record.meta ?? record.metadata),
  };
}

function flattenSearchValue(value: unknown, typeHint?: SearchResultType): SearchResultItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeResult(item, typeHint))
      .filter((item): item is SearchResultItem => !!item);
  }
  const record = asRecord(value);
  if (!record) return [];
  const nestedItem = record.item ?? record.entity;
  if (nestedItem && typeof nestedItem === 'object' && !record.title && !record.name) {
    return flattenSearchValue(nestedItem, typeHint);
  }
  if (record.id || record.entityId || record.title || record.name) {
    const item = normalizeResult(record, typeHint);
    return item ? [item] : [];
  }
  const nested =
    record.results ?? record.items ?? record.data ?? record.hits ?? record.matches ?? undefined;
  if (nested !== undefined) return flattenSearchValue(nested, typeHint);
  const grouped: SearchResultItem[] = [];
  for (const [key, entries] of Object.entries(record)) {
    const type = normalizeType(key);
    if (type && Array.isArray(entries)) grouped.push(...flattenSearchValue(entries, type));
  }
  return grouped;
}

function readMeta(value: unknown): {
  total: number | null;
  page: number | null;
  pageSize: number | null;
  hasMore: boolean | null;
  nextPage: number | null;
  counts: Partial<Record<SearchResultType, number>>;
  types: SearchResultType[];
  engine: string | null;
  hasPagination: boolean;
} {
  const record = asRecord(value);
  if (!record) {
    return {
      total: null,
      page: null,
      pageSize: null,
      hasMore: null,
      nextPage: null,
      counts: {},
      types: [],
      engine: null,
      hasPagination: false,
    };
  }
  const data = asRecord(record.data);
  const pagination = asRecord(record.pagination) ?? asRecord(record.meta) ?? null;
  const source = {
    ...(data ?? {}),
    ...record,
    ...(pagination ?? {}),
  };
  const total = asNumber(source.total ?? source.totalResults ?? source.totalCount ?? source.count);
  const page = asNumber(source.page ?? source.currentPage);
  const pageSize = asNumber(source.pageSize ?? source.limit ?? source.perPage ?? source.size);
  const hasMoreValue = source.hasMore ?? source.hasNext ?? source.hasNextPage;
  const hasMore = typeof hasMoreValue === 'boolean' ? hasMoreValue : null;
  const nextPage = asNumber(source.nextPage ?? source.next_page);
  const types = Array.isArray(source.types)
    ? source.types.map((item) => normalizeType(item)).filter((item): item is SearchResultType => !!item)
    : [];
  const engine = asText(source.engine);
  const countsRecord = asRecord(source.counts ?? source.facets ?? source.typeCounts) ?? {};
  const counts: Partial<Record<SearchResultType, number>> = {};
  for (const [key, count] of Object.entries(countsRecord)) {
    const type = normalizeType(key);
    const numeric = asNumber(count);
    if (type && numeric !== null) counts[type] = numeric;
  }
  return {
    total,
    page,
    pageSize,
    hasMore,
    nextPage,
    counts,
    types,
    engine,
    hasPagination:
      total !== null ||
      page !== null ||
      pageSize !== null ||
      hasMore !== null ||
      nextPage !== null ||
      types.length > 0 ||
      Object.keys(counts).length > 0,
  };
}

export function normalizeSearchResponse(
  value: unknown,
  query: string,
  requestedPage = 1,
  requestedLimit = 20,
  requestedType: SearchResultType | 'all' = 'all',
): NormalizedSearchResponse {
  const rawResults = flattenSearchValue(value);
  const filteredResults =
    requestedType === 'all'
      ? rawResults
      : rawResults.filter((item) => item.type === requestedType);
  const meta = readMeta(value);
  const hasUnrequestedType = rawResults.some((item) => item.type !== requestedType);
  const serverPaginated = meta.hasPagination && !(requestedType !== 'all' && hasUnrequestedType);
  const page = Math.max(1, meta.page ?? requestedPage);
  const pageSize = Math.max(1, meta.pageSize ?? requestedLimit);
  const total = Math.max(0, meta.total ?? filteredResults.length);
  const start = serverPaginated ? 0 : (page - 1) * pageSize;
  const results = serverPaginated ? filteredResults : filteredResults.slice(start, start + pageSize);
  const effectiveTotal = serverPaginated ? total : filteredResults.length;
  const pageCount = Math.max(1, Math.ceil(effectiveTotal / pageSize), meta.hasMore ? page + 1 : 1);
  const hasMore = meta.hasMore ?? start + results.length < effectiveTotal;
  const counts = { ...meta.counts };
  if (Object.keys(counts).length === 0) {
    for (const item of rawResults) counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return {
    query: asText(asRecord(value)?.query) ?? query,
    results,
    total: effectiveTotal,
    page,
    pageSize,
    pageCount,
    hasMore,
    nextPage: meta.nextPage,
    counts,
    types: meta.types,
    engine: meta.engine,
    serverPaginated,
  };
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function shouldTryNextSearchEndpoint(error: unknown): boolean {
  const status = errorStatus(error);
  if (status !== undefined) {
    return status === 400 || status === 401 || status === 403 || status === 404 || status === 405;
  }
  return error instanceof Error && /\b(400|401|403|404|405)\b/.test(error.message);
}

function searchPaths(scope: SearchScope): string[] {
  const configuredPublic =
    process.env.NEXT_PUBLIC_PUBLIC_SEARCH_PATH || process.env.NEXT_PUBLIC_SEARCH_PUBLIC_PATH;
  const configuredAdmin =
    process.env.NEXT_PUBLIC_ADMIN_SEARCH_PATH || process.env.NEXT_PUBLIC_SEARCH_ADMIN_PATH;
  const paths =
    scope === 'admin'
      ? [configuredAdmin || '/admin/search']
      : [configuredPublic || '/search', '/search/public'];
  return [...new Set(paths.filter(Boolean))];
}

function searchPath(path: string, query: string, options: Required<Pick<SiteSearchOptions, 'page' | 'limit' | 'type' | 'sort'>>): string {
  const params = new URLSearchParams({ q: query });
  if (options.page > 1) params.set('page', String(options.page));
  if (options.limit !== 20) params.set('limit', String(options.limit));
  if (options.type !== 'all') params.set('type', options.type);
  if (options.sort !== 'relevance') params.set('sort', options.sort);
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
}

async function fetchSearch(
  query: string,
  options: Required<Pick<SiteSearchOptions, 'scope' | 'page' | 'limit' | 'type' | 'sort'>>,
): Promise<NormalizedSearchResponse> {
  let lastError: unknown;
  for (const path of searchPaths(options.scope)) {
    try {
      const response = await api.get<SearchResponse>(
        searchPath(path, query, options),
      );
      return normalizeSearchResponse(response, query, options.page, options.limit, options.type);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextSearchEndpoint(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Search request failed');
}

function normalizeSearchArguments(
  enabledOrOptions: boolean | SiteSearchOptions,
): SiteSearchOptions {
  return typeof enabledOrOptions === 'boolean' ? { enabled: enabledOrOptions } : enabledOrOptions;
}

export function useSiteSearch(
  query: string,
  enabledOrOptions: boolean | SiteSearchOptions = true,
) {
  const options = normalizeSearchArguments(enabledOrOptions);
  const q = query.trim();
  const scope = options.scope ?? 'public';
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  const type = options.type ?? 'all';
  const sort = options.sort ?? 'relevance';
  const enabled = options.enabled !== false && q.length >= 2;
  const search = useQuery({
    queryKey: ['search', scope, q, page, limit, type, sort],
    queryFn: () => fetchSearch(q, { scope, page, limit, type, sort }),
    enabled,
    retry: 0,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const response = search.data;
  const results = useMemo(() => {
    const items = response?.results ?? [];
    if (sort === 'title') return [...items].sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [response?.results, sort]);
  const groups = useMemo<SearchGroup[]>(() => {
    const byType = new Map<SearchResultType, SearchResultItem[]>();
    for (const item of results) {
      const list = byType.get(item.type) ?? [];
      list.push(item);
      byType.set(item.type, list);
    }
    return TYPE_ORDER.filter((typeName) => byType.has(typeName)).map((typeName) => ({
      type: typeName,
      items: byType.get(typeName) ?? [],
    }));
  }, [results]);
  return {
    ...search,
    results,
    groups,
    total: response?.total ?? 0,
    page: response?.page ?? page,
    pageSize: response?.pageSize ?? limit,
    pageCount: response?.pageCount ?? 1,
    hasMore: response?.hasMore ?? false,
    nextPage: response?.nextPage ?? null,
    counts: response?.counts ?? {},
    types: response?.types ?? [],
    engine: response?.engine ?? null,
    scope,
  };
}
