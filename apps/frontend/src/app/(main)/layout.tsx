import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { NavMain } from '@/components/layout/nav-main';
import { Footer } from '@/components/layout/footer';
import { fetchNavigation, getNavContext } from '@/lib/builder/navigation';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug, locale } = await getNavContext();
  const items = await fetchNavigation(tenantSlug, locale);
  return (
    <div className="flex min-h-screen flex-col">
      {/* The announcement bar scrolls away; NavMain is itself `sticky top-0`.
          Pages no longer need the magic `pt-[116px]` that had to be kept in
          sync with the header's height. */}
      <AnnouncementBar />
      <NavMain items={items} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
