import Link from 'next/link';
import { cookies } from 'next/headers';
import { Globe2, Terminal } from 'lucide-react';
import { fetchPublishedAcademies } from '@/lib/academies';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
// Static brand/resource nav (honest links, no metrics). Academy links below
// are resolved live per tenant — never hardcoded slugs.
const columns = [
  {
    title: 'Resources',
    links: [
      { label: 'Post Processors', href: '/products' },
      { label: 'Feeds & Speeds', href: '/products' },
      { label: 'Tool Libraries', href: '/products?category=Tool%20Kits' },
      { label: 'Tech Support', href: '/about' },
    ],
  },
  {
    title: 'Institutional',
    links: [
      { label: 'About Our Tech', href: '/about' },
      { label: 'Partner Schools', href: '/sponsors' },
      { label: 'Press Kit', href: '/about' },
      { label: 'Careers', href: '/about' },
    ],
  },
];
export async function Footer() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  // Live academy links: real slugs/titles for this tenant. Falls back to the
  // academy index (never guessed slugs) when nothing is published.
  let academyLinks: { label: string; href: string }[] = [{ label: 'All Academies', href: '/academy' }];
  try {
    const academies = await fetchPublishedAcademies(tenantSlug);
    if (academies.length > 0) {
      academyLinks = academies
        .slice(0, 5)
        .map((a) => ({ label: a.title, href: `/academy/${a.slug}` }));
    }
  } catch {
    // keep index-link fallback
  }
  const allColumns = [{ title: 'Academies', links: academyLinks }, ...columns];
  return (
    <footer className="border-t border-border bg-card text-foreground">
      {' '}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-4 py-24 sm:grid-cols-2 md:grid-cols-4 md:px-10">
        {' '}
        <div>
          <Link href="/" className="font-display text-2xl font-semibold text-violet-600 dark:text-violet-400">
            Ahmad CNC
          </Link>
          <p className="mb-8 mt-6 max-w-xs leading-6 text-muted-foreground opacity-80">
            Pioneering the future of precision manufacturing through high-fidelity digital education
            and simulation systems.
          </p>
          <div className="flex gap-4">
            <a
              href="https://titansofmanufacturing.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-violet-600 dark:text-violet-400"
              aria-label="Ahmad CNC website"
            >
              <Globe2 className="h-4 w-4" />
            </a>
            <Link
              href="/feed"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-violet-600 dark:text-violet-400"
              aria-label="Technical community"
            >
              <Terminal className="h-4 w-4" />
            </Link>
          </div>
        </div>{' '}
        {allColumns.map((column) => (
          <div key={column.title} className="flex flex-col gap-4">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              {column.title}
            </h2>
            {column.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted-foreground opacity-80 transition hover:text-violet-600 dark:text-violet-400"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}{' '}
      </div>{' '}
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-8 border-t border-border px-4 py-12 text-xs text-muted-foreground md:flex-row md:px-10">
        <span>
          © {new Date().getFullYear()} Ahmad CNC Educational Systems. All rights reserved.
        </span>
        <div className="flex flex-wrap justify-center gap-8 text-[11px] font-medium uppercase tracking-wider">
          <span>Designed for sub-micron precision.</span>
          <span>Engineered in ISO-9001.</span>
        </div>
      </div>{' '}
    </footer>
  );
}
