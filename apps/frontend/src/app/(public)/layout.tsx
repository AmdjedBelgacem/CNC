import { NavMain } from '@/components/layout/nav-main';
import { Footer } from '@/components/layout/footer';
import { fetchNavigation, getNavContext } from '@/lib/builder/navigation';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Fetched in the layout so every public route shares one request and the
  // navbar is correct in the first HTML frame.
  const { tenantSlug, locale } = await getNavContext();
  const items = await fetchNavigation(tenantSlug, locale);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavMain items={items} />
      <main className="flex-1">{children}</main>
      {/* Public routes previously rendered no footer at all — the landing page
          ended at the last marketing section with no site links or legal row. */}
      <Footer />
    </div>
  );
}
