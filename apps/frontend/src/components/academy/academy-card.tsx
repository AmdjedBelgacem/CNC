'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { AcademySummary } from '@/lib/academies';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';

export function AcademyCard({ academy }: { academy: AcademySummary }) {
  const t = useTranslations('pages.academyCard');
  // Tenant brand color is real per-academy data; when absent we fall back to
  // design tokens rather than a hardcoded hex.
  const accent = academy.accentColor || undefined;
  const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
  const href = `/academy/${academy.slug}`;

  return (
    // `card-hover` supplies the lift, shadow ramp and press-dip. It lives in
    // globals.css rather than framer-motion so the card can stay a server
    // component — an academy grid of 12 client cards would ship JS for a hover.
    <Link href={href} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <article className="card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 group-hover:border-border-strong group-hover:shadow-lg">
        <div className="relative m-2 mb-0 aspect-[16/10] overflow-hidden rounded-xl bg-surface-sunken">
          <Image
            src={getImageSrc(image, 'academy')}
            alt={academy.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
          {academy.logoUrl && image !== academy.logoUrl ? (
            <div className="absolute start-3 top-3 size-11 overflow-hidden rounded-xl border-2 border-card bg-card shadow-md">
              <Image src={academy.logoUrl} alt="" fill sizes="44px" className="object-cover" />
            </div>
          ) : null}
          <div className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <BookOpen className="size-3" />
            {academy.courseCount} {academy.courseCount === 1 ? 'course' : 'courses'}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                !accent && 'bg-primary/10 text-primary',
              )}
              style={accent ? { backgroundColor: `${accent}15`, color: accent } : undefined}
            >
              Academy
            </span>
            {academy.subtitle ? (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {academy.subtitle}
              </span>
            ) : null}
          </div>
          <h3 className="mb-2 text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
            {academy.title}
          </h3>
          {academy.description ? (
            <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {academy.description}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
            <span
              className={cn('inline-block h-1 w-10 rounded-full transition-[width] duration-300 group-hover:w-16', !accent && 'bg-primary')}
              style={accent ? { backgroundColor: accent } : undefined}
              aria-hidden
            />
            <span
              className={cn(
                'inline-flex items-center gap-1 text-sm font-medium',
                !accent && 'text-primary',
              )}
              style={accent ? { color: accent } : undefined}
            >
              {t('viewAcademy')}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
