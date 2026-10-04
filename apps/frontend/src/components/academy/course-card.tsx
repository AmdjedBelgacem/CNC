import Link from 'next/link';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
    <Link href={`/courses/${slug}`} className="group block h-full">
      <Card className="card-hover flex h-full flex-col overflow-hidden transition-colors duration-200 group-hover:border-border-strong group-hover:shadow-sm">
        <div className="aspect-video overflow-hidden border-b border-border bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageSrc(thumbnailUrl, 'course')}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
          />
        </div>
        <CardHeader className="flex-1 gap-1 p-5">
          <CardTitle className="font-display text-lg">{title}</CardTitle>
          {subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>}
          {availableLocales && availableLocales.length > 0 && <div className="pt-2"><LanguageAvailability availableLocales={availableLocales} resolvedLocale={resolvedLocale} fallbackFields={fallbackFields} /></div>}
        </CardHeader>
        <CardFooter className="flex-col items-stretch gap-2 p-5 pt-0">
          <DifficultyBar level={difficulty} size="sm" />
          {estimatedHours && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {estimatedHours}h estimated
            </span>
          )}
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
    </Link>
  );
}
