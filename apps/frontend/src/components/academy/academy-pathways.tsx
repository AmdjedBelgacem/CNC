import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { AcademySummary } from '@/lib/academies';
import { getImageSrc } from '@/lib/images';

/**
 * Live academy pathways directory — the `academy-pathways` island.
 * Numbered full-width pathway rows with accent rails (redesigned academy UI).
 */
function PathwayRow({
  academy,
  index,
}: {
  academy: AcademySummary;
  index: number;
}) {
  const accent = academy.accentColor || 'var(--color-primary)';
  const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
  const num = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/academy/${academy.slug}`}
      className="group relative block border-b border-border first:border-t"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-1 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex flex-col gap-4 px-4 py-7 transition-colors duration-200 group-hover:bg-surface-sunken/60 sm:flex-row sm:items-center sm:gap-6 sm:px-6 md:px-8">
        <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground tabular-nums sm:w-6">
            {num}
          </span>
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageSrc(image, 'academy')}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl">
            {academy.title}
          </h3>
          {academy.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{academy.subtitle}</p>
          ) : null}
          {academy.description ? (
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-text-muted">
              {academy.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 sm:w-48 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center sm:gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            <BookOpen className="size-3" style={{ color: accent }} />
            {academy.courseCount} {academy.courseCount === 1 ? 'course' : 'courses'}
          </span>
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: accent }}
          >
            Enter academy
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function AcademyPathways({ academies }: { academies: AcademySummary[] }) {
  return (
    <section
      id="pathways"
      className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-24"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Directory
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Choose your academy
          </h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Each pathway is a full curriculum — start anywhere, switch anytime, keep your progress.
        </p>
      </div>

      {academies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <p className="font-semibold text-foreground">No academies published yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Published academies will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          {academies.map((academy, i) => (
            <PathwayRow key={academy.id} academy={academy} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
