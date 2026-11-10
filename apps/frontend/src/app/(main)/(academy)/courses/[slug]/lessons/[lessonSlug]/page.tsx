import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { fetchCourseDetail, fetchLessonDetail } from '@/lib/courses';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import type { ContentLocale } from '@titan/shared';
import { LessonPlayer } from './lesson-player';

interface PageProps {
  params: Promise<{ slug: string; lessonSlug: string }>;
}

/**
 * The existence check MUST run in the page body, before any JSX: with the loading-free
 * segment tree above it, the page render blocks the shell, so a notFound() here produces
 * a real 404 status. A generateMetadata-only gate does NOT — Next 16 streams metadata, so
 * a miss there renders the not-found UI into an already-committed 200 (soft 404).
 *
 * Both endpoints are public (optional auth), so this anonymous server check answers
 * "does it exist" without leaking enrolment state.
 */
async function loadLesson(slug: string, lessonSlug: string, locale: ContentLocale) {
  const [course, lesson] = await Promise.all([
    fetchCourseDetail(DEFAULT_TENANT_SLUG, slug, locale),
    fetchLessonDetail(DEFAULT_TENANT_SLUG, slug, lessonSlug, locale),
  ]);
  if (!course || !lesson) notFound();
  return { course, lesson };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, lessonSlug } = await params;
  const locale = (await getLocale()) as ContentLocale;
  const { course, lesson } = await loadLesson(slug, lessonSlug, locale);
  return { title: lesson.title ?? course.title };
}

export default async function LessonPage(props: PageProps) {
  const t = await getTranslations('pages.lessonPlayer');
  const { slug, lessonSlug } = await props.params;
  const locale = (await getLocale()) as ContentLocale;
  await loadLesson(slug, lessonSlug, locale);
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 py-3">
          <Link
            href={`/courses/${slug}`}
            className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 -ms-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('backToCourse')}
          </Link>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 lg:py-10">
        <LessonPlayer lessonSlug={lessonSlug} courseSlug={slug} />
      </div>
    </div>
  );
}
