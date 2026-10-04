import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BrandMark } from '@/components/layout/brand';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

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
    <footer className="mt-auto border-t border-border bg-surface-sunken/40">
      {/* Forge signature: 2px brand rule along the footer's top edge. */}
      <div className="h-0.5 w-full bg-primary" aria-hidden />
      {/* The footer is a server component (it fetches academies and translations),
          so the motion is applied by client wrappers taking it as `children` —
          the markup still renders on the server, so nothing here waits on JS to
          paint. `Stagger` needs a DOM parent for the cascade to read correctly,
          hence the grid wrapper staying put and only the cells animating. */}
      <Stagger
        className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
        inViewOnly
      >
        <StaggerItem className="lg:col-span-1">
          <Reveal from="up">
            <BrandMark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Precision manufacturing education — academies, products and a community
              built for modern machinists and engineers.
            </p>
          </Reveal>
        </StaggerItem>

        {columns.map((column, i) => (
          <StaggerItem key={column.title} index={i + 1}>
            <div className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-foreground">
                <span className="me-2 text-primary">{String(i + 1).padStart(2, '0')}</span>
                {column.title}
              </h2>
              {column.links.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <span className="font-mono tracking-[0.04em]">
          © {new Date().getFullYear()} Baroot CNC Solutions. All rights reserved.
        </span>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/privacy" className="transition-colors hover:text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-primary">
            Terms
          </Link>
          <Link href="/refunds" className="transition-colors hover:text-primary">
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
