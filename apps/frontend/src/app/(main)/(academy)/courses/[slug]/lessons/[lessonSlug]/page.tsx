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
