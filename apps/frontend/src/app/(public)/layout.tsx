import { NavMain } from '@/components/layout/nav-main';
import { Footer } from '@/components/layout/footer';
import { fetchNavigation, getNavContext } from '@/lib/builder/navigation';
import { getTranslations } from 'next-intl/server';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Fetched in the layout so every public route shares one request and the
  // navbar is correct in the first HTML frame.
  const { tenantSlug, locale } = await getNavContext();
  const items = await fetchNavigation(tenantSlug, locale);
  const t = await getTranslations('ui.a11y');
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Same skip link as the (main) group. The landing page lives in its own route
          group, so it needed its own copy — it was the one page with no way past the nav. */}
      <a
        href="#main"
        className="sr-only z-[100] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        {t('skipToContent')}
      </a>
      <NavMain items={items} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {/* Public routes previously rendered no footer at all — the landing page
          ended at the last marketing section with no site links or legal row. */}
      <Footer />
    </div>
  );
}
