import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  Layers3,
  Package,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Course } from '@titan/shared';
import { fetchAcademyDetail } from '@/lib/academies';
import { fetchLinkedProducts } from '@/lib/products';
import { getTenantSlug } from '@/lib/tenant';
import { getImageSrc } from '@/lib/images';
import { formatMoney } from '@/lib/api/normalize';
import { coerceLocale } from '@/i18n/config';
import { ProductCard, type Product as StoreProduct } from '@/components/store/product-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { serializeJsonLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/brand';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

/**
 * This route is dynamic, and must stay that way.
 *
 * `revalidate = 60` made Next treat the page as statically generatable, but the component
 * reads the tenant from an httpOnly cookie via `cookies()`. Next refuses to cache a page
 * that reads request data, and on Vercel that surfaced as a hard 500 on every request:
 *
 *   Failed to handle /academy/aerospace
 *   Server Components render ... digest: 'DYNAMIC_SERVER_USAGE'
 *
 * The route segment was still being served as a prerendered/ISR shell, so the conflict only
 * manifested in production — it reproduced on neither the dev server nor a local
 * `next start`. Data freshness comes from the fetches themselves (`next: { revalidate: 60 }`
 * inside lib/academies.ts), which is the correct place for it, rather than from the segment.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };



function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function AcademyStat({
  icon: Icon,
  value,
  label,
  inverse = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', inverse ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary')}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className={cn('font-display text-xl font-medium leading-none tracking-[-0.015em]', inverse ? 'text-white' : 'text-foreground')}>
          {value}
        </p>
        <p className={cn('mt-1 truncate text-xs', inverse ? 'text-white/60' : 'text-muted-foreground')}>
          {label}
        </p>
      </div>
    </div>
  );
}

function AcademyCourseCard({
  course,
  index,
  accent,
  levelLabel,
  accessLabel,
  seriesLabel,
  selfPacedLabel,
  coursePathLabel,
}: {
  course: Course;
  index: number;
  accent: string;
  levelLabel: string;
  accessLabel: string;
  seriesLabel: string;
  selfPacedLabel: string;
  coursePathLabel: string;
}) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="card-hover group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border-strong hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="relative m-2 mb-0 aspect-[16/9] overflow-hidden rounded-xl bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getImageSrc(course.thumbnailUrl, 'course')}
          alt={course.title}
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span
          className="absolute start-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-card/90 font-display text-sm font-medium text-foreground shadow-sm backdrop-blur"
          
        >
          {index + 1}
        </span>
        <span className="absolute bottom-3 start-3 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
          {levelLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </span>
        </div>
        {course.subtitle ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{course.subtitle}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers3 className="size-3.5 text-primary" />
            {seriesLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" />
            {course.estimatedHours ? `${course.estimatedHours}h` : selfPacedLabel}
          </span>
          <span className="ms-auto text-xs font-medium" style={{ color: accent }}>
            {accessLabel}
          </span>
        </div>
        <span className="mt-3 text-xs text-muted-foreground/70">{coursePathLabel}</span>
      </div>
    </Link>
  );
}

function toStoreProduct(product: {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  features?: string[] | null;
  thumbnailUrl?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  pricingMode?: 'fixed' | 'from' | 'request' | null;
  currency?: string | null;
  inventory?: number | null;
  allowBackorder?: boolean | null;
  backorderLeadDays?: number | null;
  isDigital?: boolean | null;
  isPublished?: boolean | null;
  category?: string | null;
  tags?: string[] | null;
  variants?: Array<{
    id: string;
    title: string;
    sku?: string | null;
    price?: number | null;
    inventory?: number | null;
    allowBackorder?: boolean | null;
    options?: Record<string, string> | null;
  }> | null;
}): StoreProduct {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    tagline: product.tagline ?? undefined,
    description: product.description ?? undefined,
    features: product.features ?? undefined,
    thumbnailUrl: product.thumbnailUrl ?? undefined,
    // Preserve a missing price instead of turning it into zero. A quote-only
    // machine converted to `0` looked free on the academy page, and the card
    // never got the `pricingMode` it needs to offer the quote form.
    price: product.price ?? undefined,
    compareAtPrice: product.compareAtPrice ?? undefined,
    pricingMode: product.pricingMode ?? undefined,
    currency: product.currency || 'SAR',
    inventory: product.inventory ?? undefined,
    allowBackorder: product.allowBackorder ?? undefined,
    backorderLeadDays: product.backorderLeadDays ?? undefined,
    isDigital: product.isDigital ?? undefined,
    isPublished: product.isPublished ?? undefined,
    category: product.category ?? undefined,
    tags: product.tags ?? undefined,
    variants: product.variants?.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? undefined,
      price: variant.price ?? undefined,
      inventory: variant.inventory ?? undefined,
      allowBackorder: variant.allowBackorder ?? undefined,
      options: variant.options ?? undefined,
    })),
  };
}

/**
 * No `generateStaticParams`: this route is `force-dynamic` because it reads the tenant from
 * a cookie. Prerendering slugs at build time also cannot work here — `API_INTERNAL_URL` is a
 * Vercel service binding that only exists at runtime, so the build-time academy fetch returns
 * nothing and the prerender is empty.
 */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const tenantSlug = await getTenantSlug();
  const locale = coerceLocale(await getLocale());
  const academy = await fetchAcademyDetail(tenantSlug, slug, locale);
  if (!academy) return { title: 'Academy not found' };

  const title = academy.seoTitle?.trim() || academy.title;
  const description = academy.seoDescription?.trim() || academy.description || academy.subtitle || 'Academy landing page';
  const path = `/academy/${academy.slug}`;
  const pageUrl = absoluteUrl(path);
  const rawImage = academy.seoImageUrl || academy.heroImageUrl || academy.logoUrl || undefined;
  const ogImage = rawImage ? (rawImage.startsWith('http') ? rawImage : absoluteUrl(rawImage)) : undefined;

  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description: description.slice(0, 200),
      type: 'website',
      url: pageUrl,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: academy.title }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description: description.slice(0, 200),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function AcademyDetailPage(props: Props) {
  const { slug } = await props.params;
  const tenantSlug = await getTenantSlug();
  const locale = coerceLocale(await getLocale());
  const t = await getTranslations('academy');
  const tc = await getTranslations('courses');
  const academy = await fetchAcademyDetail(tenantSlug, slug, locale);
  if (!academy) notFound();

  const courses = academy.courses ?? [];
  const products = academy.id
    ? await fetchLinkedProducts(tenantSlug, { academyId: academy.id, limit: 4 }, locale).catch(() => [])
    : [];
  const publishedProducts = products.filter((product) => product.isPublished !== false && product.isArchived !== true);
  const accent = academy.accentColor || 'var(--color-primary)';
  const rootStyle = { '--academy-accent': accent } as CSSProperties;
  const hero = academy.heroImageUrl || academy.seoImageUrl;
  const logo = getImageSrc(academy.logoUrl, 'academy');
  const courseCount = courses.length;
  const totalHours = courses.reduce((sum, course) => sum + (course.estimatedHours ?? 0), 0);
  const pathwayCount = courses.reduce((sum, course) => sum + (course.series?.length ?? 0), 0) || courseCount;
  const courseCountLabel = courseCount === 1 ? t('courseOne') : t('courseMany', { count: courseCount });
  const hoursLabel = totalHours > 0 ? `${totalHours}h` : t('selfPaced');
  const description = academy.description || academy.subtitle || t('academyOverview');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: academy.seoTitle || academy.title,
    description: academy.seoDescription || academy.description || academy.subtitle,
    image: hero || academy.logoUrl || undefined,
    url: absoluteUrl(`/academy/${academy.slug}`),
    provider: {
      '@type': 'Organization',
      name: 'Baroot CNC Solutions',
      url: SITE_URL,
    },
    hasCourseInstance: courses.map((course) => ({
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: course.estimatedHours ? `PT${course.estimatedHours}H` : undefined,
      url: absoluteUrl(`/courses/${course.slug}`),
    })),
  };

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} style={rootStyle} className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="relative isolate min-h-[620px] overflow-hidden border-b border-border/70 bg-neutral-950 text-white lg:min-h-[680px]">
        {hero ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt={academy.title} loading="eager" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20 rtl:bg-gradient-to-l" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/20" />
          </>
        ) : (
          <>
            <div className="blueprint-grid absolute inset-0" />
            <div className="absolute inset-0" style={{ backgroundColor: accent, opacity: 0.12 }} />
            <div className="absolute inset-0 bg-black/70" />
          </>
        )}
        <div className="absolute -end-32 -top-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-48 start-1/3 size-[24rem] rounded-full blur-3xl" style={{ backgroundColor: accent, opacity: 0.25 }} />

        <div className="relative mx-auto flex min-h-[620px] max-w-container-max flex-col px-margin-mobile pb-12 pt-5 md:px-margin-desktop md:pb-16 lg:min-h-[680px]">
          <Link href="/academy" className="group inline-flex w-fit items-center gap-2 rounded-full px-2 py-1 -ms-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('backToAcademies')}
          </Link>

          <div className="grid flex-1 items-end gap-10 pt-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm" style={{ backgroundColor: accent }}>
                  <BookOpen className="size-3.5" />
                  {t('academyLabel')}
                </span>
                <span className="font-mono text-xs text-white/50">{academy.slug}</span>
              </div>
              <h1 className="max-w-4xl text-balance font-display text-4xl font-medium leading-[1.04] tracking-[-0.025em] sm:text-5xl lg:text-7xl">
                {academy.title}
              </h1>
              {academy.subtitle ? (
                <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white/75 sm:text-xl">
                  {academy.subtitle}
                </p>
              ) : null}

              <div className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-y border-white/15 py-5 sm:grid-cols-3">
                <AcademyStat inverse icon={BookOpen} value={String(courseCount)} label={courseCountLabel} />
                <AcademyStat inverse icon={Clock} value={hoursLabel} label={t('estimatedHours')} />
                <AcademyStat inverse icon={Layers3} value={String(pathwayCount)} label={t('learningPaths')} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-6">
                  <Link href="#courses">
                    {t('browseCourses')}
                    <ArrowRight className="rtl:rotate-180" />
                  </Link>
                </Button>
                {publishedProducts.length > 0 ? (
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/30 bg-white/5 text-white backdrop-blur hover:border-white/50 hover:bg-white/10 hover:text-white">
                    <Link href="#tools">
                      <Package className="size-4" />
                      {t('exploreTools')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="relative justify-self-start lg:justify-self-end">
              <div className="pointer-events-none absolute -inset-2 rounded-3xl border opacity-60" style={{ borderColor: accent }} />
              <div className="relative w-60 animate-fade-in-up rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-white/25 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <Badge variant="soft" className="border-white/15 bg-white/10 text-white">
                      <Sparkles className="size-3" />
                      {t('published')}
                    </Badge>
                    <p className="mt-2 truncate text-sm font-medium text-white/85">{academy.subtitle || academy.title}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-xs text-white/60">
                  <span>{t('visual')}</span>
                  <span>{courseCountLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-16 md:px-margin-desktop md:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <Reveal className="min-w-0">
            <p className="eyebrow">{t('academyOverview')}</p>
            <h2 className="mt-4 max-w-3xl text-balance font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              {academy.subtitle || academy.title}
            </h2>
            <p className="mt-5 max-w-prose whitespace-pre-line text-base leading-8 text-muted-foreground sm:text-lg">
              {description}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="h-1 w-14 rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-xs font-medium text-muted-foreground">{t('academyPath')}</span>
            </div>
          </Reveal>

          <Card className="h-fit overflow-hidden rounded-2xl border-border/70 shadow-sm">
            <div className="border-b border-border/60 bg-muted/40 px-6 py-5">
              <p className="eyebrow">{t('atAGlance')}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
                <span className="text-xs font-medium text-foreground">{t('published')}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 p-6">
              <AcademyStat icon={BookOpen} value={String(courseCount)} label={courseCountLabel} />
              <AcademyStat icon={Clock} value={hoursLabel} label={t('estimatedHours')} />
              <AcademyStat icon={Layers3} value={String(pathwayCount)} label={t('learningPaths')} />
              <AcademyStat icon={Compass} value={t('selfPaced')} label={t('flexiblePacing')} />
            </div>
          </Card>
        </div>
      </section>

      <section id="courses" className="scroll-mt-24 border-y border-border/70 bg-muted/30">
        <div className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop md:py-24">
          <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">{t('learningPaths')}</p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">{t('browseCourses')}</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{t('readyDescription')}</p>
          </Reveal>

          {courses.length === 0 ? (
            <Card className="mt-10 rounded-2xl border-dashed bg-card/60">
              <EmptyState
                icon={Compass}
                title={t('noCoursesTitle')}
                description={t('noCoursesDescription')}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/courses">{tc('title')}</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <Stagger inViewOnly className="mt-10 grid gap-6 md:grid-cols-2">
              {courses.map((course, index) => {
                const levelLabel = (course.difficulty ?? 1) <= 1 ? tc('beginner') : (course.difficulty ?? 1) === 2 ? tc('intermediate') : tc('advanced');
                const seriesCount = course.series?.length ?? 0;
                const seriesLabel = seriesCount > 0 ? t('seriesCount', { count: seriesCount }) : t('coursePath');
                const hasPrice = typeof course.priceCents === 'number' && course.priceCents > 0;
                const accessLabel = course.accessMode === 'invite'
                  ? t('inviteAccess')
                  : hasPrice
                    ? formatMoney(course.priceCents, course.currency || 'SAR', locale)
                    : course.accessMode === 'paid'
                      ? t('courseAccess')
                      : t('openAccess');
                return (
                  <StaggerItem key={course.id} index={index}>
                  <AcademyCourseCard
                    course={course}
                    index={index}
                    accent={accent}
                    levelLabel={levelLabel}
                    accessLabel={accessLabel}
                    seriesLabel={seriesLabel}
                    selfPacedLabel={t('selfPaced')}
                    coursePathLabel={t('coursePath')}
                  />
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </div>
      </section>

      {publishedProducts.length > 0 ? (
        <section id="tools" className="mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-16 md:px-margin-desktop md:py-24">
          <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">{t('academyLabel')}</p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">{t('toolsTitle')}</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{t('toolsDescription')}</p>
          </Reveal>
          <Stagger inViewOnly className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {publishedProducts.map((product, index) => (
              <StaggerItem key={product.id} index={index}>
                <ProductCard product={toStoreProduct(product)} />
              </StaggerItem>
            ))}
          </Stagger>
          <Link href="/products" className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 transition hover:underline">
            {t('browseAllTools')}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </section>
      ) : null}

      <section className="mx-auto max-w-container-max px-margin-mobile pb-12 md:px-margin-desktop md:pb-16">
        <Reveal className="relative isolate overflow-hidden rounded-2xl border border-border/70 bg-card px-6 py-10 shadow-sm sm:px-12 sm:py-14">
          <div className="ambient-wash absolute inset-0 -z-10" aria-hidden />
          <div className="absolute -end-10 -top-20 -z-10 size-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: accent }} aria-hidden />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="eyebrow">{t('readyTitle')}</p>
              <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">{academy.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('readyDescription')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6">
                <Link href="#courses">
                  {t('browseCourses')}
                  <ArrowRight className="rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full">
                <Link href="/academy">
                  <ArrowLeft className="size-4 rtl:rotate-180" />
                  {t('backToAcademies')}
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
