import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BrandMark } from '@/components/layout/brand';
import { Reveal } from '@/components/ui/motion';

const STATIC_COLUMNS = [
  {
    titleKey: 'resources',
    links: [
      { labelKey: 'products', href: '/products' },
      { labelKey: 'community', href: '/feed' },
      { labelKey: 'events', href: '/events' },
      { labelKey: 'about', href: '/about' },
    ],
  },
  {
    titleKey: 'institutional',
    links: [
      { labelKey: 'about', href: '/about' },
      { labelKey: 'sponsors', href: '/sponsors' },
      { labelKey: 'privacy', href: '/privacy' },
      { labelKey: 'terms', href: '/terms' },
    ],
  },
] as const;

export async function Footer() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const tChrome = await getTranslations('chrome');

  // Live academy links: real slugs/titles for this tenant. Falls back to the
  // academy index rather than guessing slugs.
  let academyLinks: { label: string; href: string }[] = [
    { label: t('academies'), href: '/academy' },
  ];
  try {
    const academies = await fetchPublishedAcademies(tenantSlug);
    if (academies.length > 0) {
      academyLinks = academies
        .slice(0, 5)
        .map((a) => ({ label: a.title, href: `/academy/${a.slug}` }));
    }
  } catch {
    // keep the index-link fallback
  }

  const columns = [
    { title: t('academies'), links: academyLinks },
    ...STATIC_COLUMNS.map((c) => ({
      title: c.titleKey === 'resources' ? t('resources') : tc('learnMore'),
      links: c.links.map((l) => ({ label: t(l.labelKey as 'about'), href: l.href })),
    })),
  ];

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border/70 bg-surface-sunken/50">
      {/* A whisper of clay bloom in the corner — the page "settles" into the footer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 start-[-10%] h-80 w-[60%] rounded-full bg-primary/[0.05] blur-3xl"
      />
      {/* The footer is a server component (it fetches academies and translations),
          so motion comes from client wrappers taking it as `children` — the markup
          still renders on the server, so nothing here waits on JS to paint. */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-12 pt-16 sm:px-6 md:pt-20 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <Reveal className="lg:col-span-5 lg:pe-12">
          <BrandMark />
          <p className="mt-6 max-w-sm text-balance font-display text-xl font-normal leading-snug tracking-[-0.01em] text-foreground/85">
            {tChrome('footerTagline')}
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
          {columns.map((column, i) => (
            <Reveal key={column.title} delay={0.06 * (i + 1)} className="flex flex-col">
              <h2 className="text-sm font-medium text-foreground">{column.title}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-px transition-[background-size] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-[length:100%_1px]">
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="hairline" aria-hidden />
        <div className="flex flex-col items-center justify-between gap-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>{tChrome('rights', { year: new Date().getFullYear(), brand: BRAND_NAME })}</span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/refunds" className="transition-colors hover:text-foreground">
              Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
