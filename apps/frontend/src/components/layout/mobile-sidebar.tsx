'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { X, GraduationCap, Rss, Calendar, Store, Wrench, Home } from 'lucide-react';
const mobileLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/academy', label: 'Academies', icon: GraduationCap },
  { href: '/feed', label: 'Community', icon: Rss },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/products', label: 'Store', icon: Store },
  { href: '/repair', label: 'Repair', icon: Wrench },
];
export function MobileSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  return (
    <>
      {' '}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}{' '}
      <div
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-background pt-4 transition-transform duration-300 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {' '}
        <div className="flex items-center justify-between px-4 pb-4 border-b">
          {' '}
          <Link href="/" onClick={toggleSidebar} className="flex items-center gap-2">
            {' '}
            <span className="font-display text-xl font-semibold text-[#7c3aed]">
              Ahmad CNC
            </span>{' '}
          </Link>{' '}
          <button
            onClick={toggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="Close navigation menu"
          >
            {' '}
            <X className="h-5 w-5" />{' '}
          </button>{' '}
        </div>{' '}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {' '}
          {mobileLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={toggleSidebar}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
                  pathname === link.href
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {' '}
                <Icon className="h-5 w-5 shrink-0" /> {link.label}{' '}
              </Link>
            );
          })}{' '}
        </nav>{' '}
        <div className="border-t p-4 text-xs text-muted-foreground text-center">
          {' '}
          Ahmad CNC Education{' '}
        </div>{' '}
      </div>{' '}
    </>
  );
}
