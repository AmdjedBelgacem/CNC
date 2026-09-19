import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/users';
import { courses, series, lessons } from '../../database/schema/courses';
import { productsBundle } from '../../database/schema/products';
import { posts } from '../../database/schema/posts';
import { events } from '../../database/schema/events';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

export type SearchResultType = 'course' | 'series' | 'lesson' | 'user' | 'product' | 'post' | 'event';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

const LIMIT_PER_TYPE = 5;
const PUBLIC_LIMIT_PER_TYPE = 4;

@Injectable()
export class SearchService {
  constructor(private drizzle: DrizzleService) {}

  async search(query: string, tenantId: string): Promise<SearchResponse> {
    const q = (query || '').trim();
    if (!q || !tenantId) return { query, results: [] };

    const pattern = `%${q}%`;

    const [courseRows, seriesRows, lessonRows, userRows] = await Promise.all([
      this.drizzle.db
        .select({ id: courses.id, title: courses.title, subtitle: courses.subtitle, slug: courses.slug })
        .from(courses)
        .where(
          and(
            eq(courses.tenantId, tenantId),
            eq(courses.isArchived, false),
            or(ilike(courses.title, pattern), ilike(sql`COALESCE(${courses.slug}, '')`, pattern)),
          ),
        )
        .orderBy(asc(courses.title))
        .limit(LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: series.id, title: series.title, slug: series.slug, courseId: series.courseId })
        .from(series)
        .where(and(eq(series.tenantId, tenantId), eq(series.isArchived, false), ilike(series.title, pattern)))
        .orderBy(asc(series.title))
        .limit(LIMIT_PER_TYPE),
      this.drizzle.db
        .select({
          id: lessons.id,
          title: lessons.title,
          slug: lessons.slug,
          seriesId: lessons.seriesId,
          seriesTitle: series.title,
        })
        .from(lessons)
        .innerJoin(series, eq(lessons.seriesId, series.id))
        .where(and(eq(lessons.tenantId, tenantId), eq(lessons.isArchived, false), ilike(lessons.title, pattern)))
        .orderBy(asc(lessons.title))
        .limit(LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            or(ilike(users.name, pattern), ilike(users.email, pattern)),
          ),
        )
        .orderBy(asc(users.name))
        .limit(LIMIT_PER_TYPE),
    ]);

    const results: SearchResultItem[] = [
      ...courseRows.map((c) => ({
        type: 'course' as const,
        id: c.id,
        title: c.title,
        subtitle: c.subtitle ?? null,
        href: `/courses/${c.slug}`,
      })),
      ...seriesRows.map((s) => ({
        type: 'series' as const,
        id: s.id,
        title: s.title,
        subtitle: null,
        href: `/admin/courses?series=${s.id}`,
      })),
      ...lessonRows.map((l) => ({
        type: 'lesson' as const,
        id: l.id,
        title: l.title,
        subtitle: l.seriesTitle ?? null,
        href: `/admin/courses/lessons/${l.id}`,
      })),
      ...userRows.map((u) => ({
        type: 'user' as const,
        id: u.id,
        title: u.name || u.email,
        subtitle: u.email,
        href: `/admin/users?focus=${u.id}`,
      })),
    ];

    return { query: q, results };
  }

  async searchPublic(query: string, tenantId: string): Promise<SearchResponse> {
    const q = (query || '').trim();
    if (!q || !tenantId) return { query, results: [] };

    const pattern = `%${q}%`;

    const [courseRows, productRows, postRows, eventRows, userRows] = await Promise.all([
      this.drizzle.db
        .select({ id: courses.id, title: courses.title, subtitle: courses.subtitle, slug: courses.slug })
        .from(courses)
        .where(
          and(
            eq(courses.tenantId, tenantId),
            eq(courses.isPublished, true),
            eq(courses.isArchived, false),
            or(ilike(courses.title, pattern), ilike(courses.subtitle, pattern), ilike(sql`COALESCE(${courses.slug}, '')`, pattern)),
          ),
        )
        .orderBy(asc(courses.title))
        .limit(PUBLIC_LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: productsBundle.id, title: productsBundle.title, tagline: productsBundle.tagline, slug: productsBundle.slug })
        .from(productsBundle)
        .where(
          and(
            eq(productsBundle.tenantId, tenantId),
            eq(productsBundle.isPublished, true),
            or(ilike(productsBundle.title, pattern), ilike(sql`COALESCE(${productsBundle.tagline}, '')`, pattern)),
          ),
        )
        .orderBy(asc(productsBundle.title))
        .limit(PUBLIC_LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: posts.id, content: posts.content })
        .from(posts)
        .where(
          and(
            eq(posts.tenantId, tenantId),
            eq(posts.isPublic, true),
            ilike(posts.content, pattern),
          ),
        )
        .orderBy(asc(posts.createdAt))
        .limit(PUBLIC_LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: events.id, title: events.title, slug: events.slug })
        .from(events)
        .where(
          and(
            eq(events.tenantId, tenantId),
            eq(events.isPublished, true),
            or(ilike(events.title, pattern), ilike(sql`COALESCE(${events.slug}, '')`, pattern)),
          ),
        )
        .orderBy(asc(events.startDate))
        .limit(PUBLIC_LIMIT_PER_TYPE),
      this.drizzle.db
        .select({ id: users.id, name: users.name, username: users.username, headline: users.headline })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.portfolioEnabled, true),
            eq(users.isActive, true),
            sql`${users.accountStatus} = 'active'`,
            sql`${users.deletedAt} IS NULL`,
            or(
              ilike(users.name, pattern),
              ilike(sql`COALESCE(${users.username}, '')`, pattern),
              ilike(sql`COALESCE(${users.headline}, '')`, pattern),
            ),
          ),
        )
        .orderBy(asc(users.name))
        .limit(PUBLIC_LIMIT_PER_TYPE),
    ]);

    const results: SearchResultItem[] = [
      ...courseRows.map((c) => ({
        type: 'course' as const,
        id: c.id,
        title: c.title,
        subtitle: c.subtitle ?? null,
        href: `/courses/${c.slug}`,
      })),
      ...productRows.map((p) => ({
        type: 'product' as const,
        id: p.id,
        title: p.title,
        subtitle: p.tagline ?? null,
        href: `/products/${p.slug}`,
      })),
      ...postRows.map((p) => ({
        type: 'post' as const,
        id: p.id,
        title: p.content.slice(0, 80) + (p.content.length > 80 ? '…' : ''),
        subtitle: null,
        href: `/feed?post=${p.id}`,
      })),
      ...eventRows.map((e) => ({
        type: 'event' as const,
        id: e.id,
        title: e.title,
        subtitle: null,
        href: `/events/${e.slug}`,
      })),
      ...userRows.map((u) => ({
        type: 'user' as const,
        id: u.id,
        title: u.name || u.username || 'User',
        subtitle: u.headline ?? null,
        href: `/u/${u.username ?? u.id}`,
      })),
    ];

    return { query: q, results };
  }
}
