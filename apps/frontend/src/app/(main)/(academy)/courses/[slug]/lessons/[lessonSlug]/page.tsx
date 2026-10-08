import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LessonPlayer } from './lesson-player';

export default async function LessonPage(props: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const t = await getTranslations('pages.lessonPlayer');
  const { slug, lessonSlug } = await props.params;
  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface-sunken">
        <div className="container mx-auto px-4 py-3">
          <Link
            href={`/courses/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('backToCourse')}
          </Link>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <LessonPlayer lessonSlug={lessonSlug} courseSlug={slug} />
      </div>
    </div>
  );
}
