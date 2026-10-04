'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useAcademies } from '@/hooks/use-academies';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Course categories.
 *
 * Courses have no `category` column — an academy *is* the category here (a course
 * belongs to an academy). The chips therefore drive `?academy=<slug>`, which is the
 * filter `/courses` already understands, and the taxonomy comes from live rows
 * rather than a hardcoded list.
 */
export function CategoryFilter() {
  const t = useTranslations('categories');
  const searchParams = useSearchParams();
  const active = searchParams.get('academy')?.trim() || '';

  const { academies, isLoading } = useAcademies();

  if (isLoading) {
    return (
      <div className="mb-8 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
    );
  }

  if (academies.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <Layers className="size-3" />
        {t('browse')}
      </h2>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/courses"
          className={cn(
            'rounded-md border px-4 py-1.5 text-sm font-medium transition-colors duration-150',
            !active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {t('all')}
        </Link>

        {academies.map((academy) => {
          const isActive = active === academy.slug;
          return (
            <Link
              key={academy.id}
              href={`/courses?academy=${encodeURIComponent(academy.slug)}`}
              className={cn(
                'rounded-md border px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {academy.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
