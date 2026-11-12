import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CourseDetailClient from './course-detail-client';
import { CourseDetailSkeleton } from '@/components/skeletons/public-route-skeletons';
import { fetchCourseDetail } from '@/lib/courses';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BRAND_NAME, OG_IMAGE, absoluteUrl } from '@/lib/brand';
import { courseJsonLd, breadcrumbJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';
import { getLocale } from 'next-intl/server';
import type { ContentLocale } from '@titan/shared';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Coerce whatever the API returned into a clean one-line description. */
function describe(input: string | undefined | null, max = 158): string {
  const text = (input ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,.;:—-]+$/, '')}…`;
}

/**
 * Server component for the course detail page.
 *
 * This page used to be `'use client'` end to end, so the first HTML response was a
 * skeleton ending in the literal word "Loading": crawlers and answer engines received no
 * course title, no description and no curriculum. Fetching here and handing the result to
 * the client component means the response a bot receives is the real page.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const course = await fetchCourseDetail(
    DEFAULT_TENANT_SLUG,
    slug,
    locale as ContentLocale,
  );
  const t = await getTranslations('courses');

  if (!course) {
    // Unknown slug: generic noindex metadata. The real 404 status comes from the page
    // body's notFound() below — a gate here would stream into an already-committed 200
    // (Next 16 streams metadata), i.e. the exact soft 404 crawlers complain about.
    return {
      title: t('title'),
      description: t('subtitle'),
      robots: { index: false, follow: true },
      alternates: { canonical: absoluteUrl(`/courses/${slug}`) },
    };
  }

  const title = course.title;
  const description =
    describe(course.description) || describe(course.subtitle) || `${course.title} — ${BRAND_NAME}`;
  const url = absoluteUrl(`/courses/${slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: BRAND_NAME,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const course = await fetchCourseDetail(
    DEFAULT_TENANT_SLUG,
    slug,
    locale as ContentLocale,
  );
  if (!course) notFound();

  return (
    <>
      {/* Schema is emitted server-side beside the content it describes. */}
      {course ? (
        <script
          type="application/ld+json"
          // serializeJsonLd escapes every `<`, so course copy cannot break out of the tag.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(courseJsonLd(course)) }}
        />
      ) : null}
      {course ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              breadcrumbJsonLd([
                { name: 'Home', path: '/' },
                { name: 'Courses', path: '/courses' },
                { name: course.title, path: `/courses/${slug}` },
              ]),
            ),
          }}
        />
      ) : null}

      {/* Rendered outside Suspense so the real content is never behind a fallback. */}
      <Suspense fallback={<CourseDetailSkeleton />}>
        <CourseDetailClient initialCourse={course} />
      </Suspense>
    </>
  );
}
