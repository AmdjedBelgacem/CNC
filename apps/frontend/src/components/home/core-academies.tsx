import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

/**
 * Public "Core Academies" section.
 *
 * Two rules this component follows:
 *  1. It renders REAL rows from GET /academies. There is no mock card array —
 *     inventing academies on a public page is a correctness bug, not a fallback.
 *  2. Every number shown is a real column. The previous version displayed
 *     `+${courseCount * 10}` as a student count, which is fabricated data.
 */
export async function CoreAcademies() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;

  const academies = await fetchPublishedAcademies(tenantSlug);
  if (academies.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 md:px-10" aria-labelledby="academies-title">
      <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <h2
            id="academies-title"
            className="font-display mb-4 text-[44px] font-semibold leading-[1.2] text-foreground"
          >
            Core Academies
          </h2>
          <p className="leading-6 text-muted-foreground">
            Comprehensive certifications designed for professional career advancement in modern
            manufacturing facilities.
          </p>
        </div>
        <Link
          href="/academy"
          className="group inline-flex min-h-11 items-center rounded-full border border-violet-600/20 px-6 text-xs font-bold uppercase tracking-wider text-violet-600 transition hover:bg-violet-600/5 dark:text-violet-400"
        >
          View All Paths{' '}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {academies.slice(0, 3).map((academy) => {
          const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
          return (
            <article
              key={academy.id}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:shadow-lg"
            >
              <Link href={`/academy/${academy.slug}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={academy.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-violet-600/5 text-4xl font-bold text-violet-600/20">
                      {academy.title[0]}
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-violet-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-600 dark:text-violet-400">
                      Academy
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {academy.courseCount} {academy.courseCount === 1 ? 'Course' : 'Courses'}
                    </span>
                  </div>
                  <h3 className="mb-4 text-2xl font-semibold leading-tight text-foreground">
                    {academy.title}
                  </h3>
                  <p className="mb-8 line-clamp-2 leading-6 text-muted-foreground">
                    {academy.description || academy.subtitle || ''}
                  </p>
                  <div className="flex items-center justify-between border-t border-border pt-6">
                    {/* Real, verifiable metric only — no invented student counts. */}
                    <span className="text-xs font-medium text-muted-foreground">
                      {academy.courseCount === 0
                        ? 'Courses coming soon'
                        : `${academy.courseCount} published ${academy.courseCount === 1 ? 'course' : 'courses'}`}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                      Explore
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
