import { ISLAND_HEAD, ISLAND_PAD } from '@titan/shared';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { AcademySummary } from '@/lib/academies';
import { getImageSrc } from '@/lib/images';
import { cn } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

type IslandChrome = {
  /** Builder-authored header nodes. Arabic pages omit it and keep the translated header. */
  header?: ReactNode;
  /** Builder canvas preview: render the live rows without the header. */
  bodyOnly?: boolean;
};

/**
 * Live academy pathways directory — the `academy-pathways` island.
 * Numbered full-width pathway rows with accent rails (redesigned academy UI).
 */
function PathwayRow({
  academy,
  index,
  courseLabel,
  enterLabel,
}: {
  academy: AcademySummary;
  index: number;
  /** Resolved by the async parent; a hook cannot be used inside this child. */
  courseLabel: string;
  enterLabel: string;
}) {
  const accent = academy.accentColor || 'var(--color-primary)';
  const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
  const num = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/academy/${academy.slug}`}
      className="group relative block border-b border-border/60 last:border-b-0"
    >
      <span
        aria-hidden
        className="absolute inset-y-3 start-0 w-0.5 origin-center scale-y-0 rounded-full transition-transform duration-300 ease-out group-hover:scale-y-100"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex flex-col gap-4 px-4 py-7 transition-colors duration-200 group-hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-6 sm:px-6 md:px-8">
        <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
          <span className="font-display text-lg font-medium tabular-nums text-muted-foreground/70 transition-colors group-hover:text-primary sm:w-7">
            {num}
          </span>
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-sunken ring-1 ring-inset ring-foreground/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageSrc(image, 'academy')}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-2xl">
            {academy.title}
          </h3>
          {academy.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{academy.subtitle}</p>
          ) : null}
          {academy.description ? (
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {academy.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 sm:w-48 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center sm:gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="size-3" style={{ color: accent }} />
            {academy.courseCount} {courseLabel}
          </span>
          <span
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={{ color: accent }}
          >
            {enterLabel}
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export async function AcademyPathways({
  academies,
  header,
  bodyOnly,
}: { academies: AcademySummary[] } & IslandChrome) {
  const t = await getTranslations('pages.academyPathways');
  return (
    <section
      id="pathways"
      className={cn(
        'px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto ',
        ISLAND_PAD['academy-pathways'].section,
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      {bodyOnly
        ? null
        : header ?? (
            <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={ISLAND_HEAD.eyebrow}>{t('directory')}</p>
                <h2 className={ISLAND_HEAD.titleXl}>
                  {t('chooseAcademy')}
                </h2>
              </div>
              <p className={ISLAND_HEAD.aside}>
                {t('directoryBlurb')}
              </p>
            </Reveal>
          )}

      {academies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-display text-xl font-medium text-foreground">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('emptyBody')}
          </p>
        </div>
      ) : (
        <Stagger inViewOnly className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
          {academies.map((academy, i) => (
            <StaggerItem key={academy.id} index={i}>
              <PathwayRow
                academy={academy}
                index={i}
                courseLabel={t('courseCount', { count: academy.courseCount })}
                enterLabel={t('enterAcademy')}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
