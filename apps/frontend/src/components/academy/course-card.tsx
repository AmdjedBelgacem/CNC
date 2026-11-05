import Link from 'next/link';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MotionCard } from '@/components/ui/motion';
import { DifficultyBar } from './difficulty-bar';
import { getImageSrc } from '@/lib/images';
import { LanguageAvailability } from '@/components/academy/language-availability';
import type { ContentLocale } from '@titan/shared';

interface CourseCardProps {
  slug: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  difficulty: number;
  estimatedHours?: number | null;
  progress?: number;
  availableLocales?: ContentLocale[];
  resolvedLocale?: ContentLocale;
  fallbackFields?: string[];
}

export function CourseCard({
  slug,
  title,
  subtitle,
  thumbnailUrl,
  difficulty,
  estimatedHours,
  progress,
  availableLocales,
  resolvedLocale,
  fallbackFields,
}: CourseCardProps) {
  return (
    <Link
      href={`/courses/${slug}`}
      className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Hover lift on a spring; the CSS transition below still owns the
          border/shadow half so the two settle at slightly different rates. */}
      <MotionCard lift={5} className="h-full">
        <Card className="card-hover flex h-full flex-col overflow-hidden rounded-2xl border-border/70 shadow-xs transition-[border-color,box-shadow] duration-300 group-hover:border-border-strong group-hover:shadow-lg">
        <div className="relative m-2 mb-0 aspect-[16/10] overflow-hidden rounded-xl bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageSrc(thumbnailUrl, 'course')}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/5" aria-hidden />
        </div>
        <CardHeader className="flex-1 gap-1.5 px-5 pb-4 pt-5">
          <CardTitle className="text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] transition-colors group-hover:text-primary">
            {title}
          </CardTitle>
          {subtitle && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          {availableLocales && availableLocales.length > 0 && (
            <div className="pt-2">
              <LanguageAvailability availableLocales={availableLocales} resolvedLocale={resolvedLocale} fallbackFields={fallbackFields} />
            </div>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-stretch gap-3 border-t border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <DifficultyBar level={difficulty} size="sm" />
            </div>
            {estimatedHours && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {estimatedHours}h estimated
              </span>
            )}
          </div>
          {progress !== undefined && (
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} label="Progress" className="h-1.5" />
            </div>
          )}
        </CardFooter>
      </Card>
      </MotionCard>
    </Link>
  );
}
