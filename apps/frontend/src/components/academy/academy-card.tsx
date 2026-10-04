import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { AcademySummary } from '@/lib/academies';
import { cn } from '@/lib/utils';
import { getImageSrc } from '@/lib/images';

export function AcademyCard({ academy }: { academy: AcademySummary }) {
  // Tenant brand color is real per-academy data; when absent we fall back to
  // design tokens rather than a hardcoded hex.
  const accent = academy.accentColor || undefined;
  const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
  const href = `/academy/${academy.slug}`;

  return (
    // `card-hover` supplies the lift, shadow ramp and press-dip. It lives in
    // globals.css rather than framer-motion so the card can stay a server
    // component — an academy grid of 12 client cards would ship JS for a hover.
    <Link href={href} className="group block h-full">
      <article className="card-hover flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors duration-200 group-hover:border-border-strong group-hover:shadow-sm">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageSrc(image, 'academy')}
            alt={academy.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
          />
          {academy.logoUrl && image !== academy.logoUrl ? (
            <div className="absolute start-3 top-3 size-11 overflow-hidden rounded-md border border-border bg-card shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={academy.logoUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-sm bg-overlay/70 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white">
            <BookOpen className="size-3" />
            {academy.courseCount} {academy.courseCount === 1 ? 'course' : 'courses'}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-sm px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
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
          <h3 className="mb-2 font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
            {academy.title}
          </h3>
          {academy.description ? (
            <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {academy.description}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
            <span
              className={cn('inline-block h-1 w-10 rounded-sm', !accent && 'bg-primary')}
              style={accent ? { backgroundColor: accent } : undefined}
              aria-hidden
            />
            <span
              className={cn(
                'inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
                !accent && 'text-primary',
              )}
              style={accent ? { color: accent } : undefined}
            >
              View academy
              <ArrowRight className="size-3 rtl:rotate-180" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
