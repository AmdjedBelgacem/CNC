import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LessonPlayer } from './lesson-player';
export default async function LessonPage(props: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await props.params;
  return (
    <div className="min-h-screen">
      {' '}
      <div className="border-b bg-secondary/20">
        {' '}
        <div className="container mx-auto px-4 py-3">
          {' '}
          <Link
            href={`/courses/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {' '}
            <ArrowLeft className="h-4 w-4" /> Back to course{' '}
          </Link>{' '}
        </div>{' '}
      </div>{' '}
      <div className="container mx-auto px-4 py-8">
        {' '}
        <LessonPlayer lessonSlug={lessonSlug} courseSlug={slug} />{' '}
      </div>{' '}
    </div>
  );
}
