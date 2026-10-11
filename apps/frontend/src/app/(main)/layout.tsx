import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { NavMain } from '@/components/layout/nav-main';
import { Footer } from '@/components/layout/footer';
import { fetchNavigation, getNavContext } from '@/lib/builder/navigation';
import { getTranslations } from 'next-intl/server';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug, locale } = await getNavContext();
  const items = await fetchNavigation(tenantSlug, locale);
  const t = await getTranslations('ui.a11y');
  const skipToContent = t('skipToContent');
  return (
    <div className="flex min-h-screen flex-col">
      {/* The announcement bar scrolls away; NavMain is itself `sticky top-0`.
          Pages no longer need the magic `pt-[116px]` that had to be kept in
          sync with the header's height. */}
      {/*
        Skip link. Keyboard and screen-reader users otherwise tab through the entire
        announcement bar, logo, navigation, locale switcher and theme toggle on every
        single page before reaching the content. It is the first focusable element in
        the DOM, is visually hidden until focused, and moves focus (not just scroll) to
        `#main` — the `tabIndex={-1}` is what lets a non-interactive element receive focus.
      */}
      <a
        href="#main"
        className="sr-only z-[100] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        {skipToContent}
      </a>
      <AnnouncementBar />
      <NavMain items={items} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
