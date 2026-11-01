'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useAcademies } from '@/hooks/use-academies';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { m } from 'framer-motion';
import { spring } from '@/lib/motion';

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
      <div className="mb-10 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  if (academies.length === 0) return null;

  const chip = (href: string, label: string, isActive: boolean, key: string) => (
    <Link
      key={key}
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {isActive && (
        <m.span
          layoutId="course-category-active"
          transition={spring.smooth}
          className="absolute inset-0 rounded-full bg-foreground shadow-sm"
          aria-hidden
        />
      )}
      <span className="relative">{label}</span>
    </Link>
  );

  return (
    <div className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Layers className="size-3.5" />
        {t('browse')}
      </h2>
      <div className="-mx-1 flex flex-wrap gap-1 rounded-full">
        {chip('/courses', t('all'), !active, 'all')}
        {academies.map((academy) =>
          chip(
            `/courses?academy=${encodeURIComponent(academy.slug)}`,
            academy.title,
            active === academy.slug,
            academy.id,
          ),
        )}
      </div>
    </div>
  );
}
