'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Shield,
  AlertTriangle,
  Bell,
  Palette,
  Eye,
  Link2,
  CreditCard,
  ChevronLeft,
  Menu,
  X,
  UserCircle,
  Settings,
  Sparkles,
} from 'lucide-react';
const sidebarSections = [
  {
    label: 'Account',
    items: [
      { href: '/settings/account', icon: User, label: 'General', desc: 'Name, email, language' },
      {
        href: '/settings/account/security',
        icon: Shield,
        label: 'Security',
        desc: 'Password, 2FA, sessions',
      },
      {
        href: '/settings/account/danger',
        icon: AlertTriangle,
        label: 'Danger Zone',
        desc: 'Export & delete',
      },
    ],
  },
  {
    label: 'Profile',
    items: [
      {
        href: '/settings/profile',
        icon: UserCircle,
        label: 'Edit Profile',
        desc: 'Avatar, bio, portfolio',
      },
    ],
  },
  {
    label: 'Preferences',
    items: [
      {
        href: '/settings/preferences/notifications',
        icon: Bell,
        label: 'Notifications',
        desc: 'Email & in-app',
      },
      {
        href: '/settings/preferences/appearance',
        icon: Palette,
        label: 'Appearance',
        desc: 'Theme & density',
      },
      {
        href: '/settings/preferences/privacy',
        icon: Eye,
        label: 'Privacy',
        desc: 'Visibility & follows',
      },
    ],
  },
  {
    label: 'Connections',
    items: [
      {
        href: '/settings/connected-accounts',
        icon: Link2,
        label: 'Connected Accounts',
        desc: 'OAuth links',
      },
      { href: '/settings/billing', icon: CreditCard, label: 'Billing', desc: 'Plans & invoices' },
    ],
  },
];
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const activeSection = sidebarSections.flatMap((s) => s.items).find((i) => isActive(i.href));
  return (
    <div className="min-h-screen bg-background">
      {' '}
      {/* Top bar — floating, same width as content, stays under global navbar */}{' '}
      <div className="sticky top-[76px] z-20 mx-auto max-w-[1600px] px-4 sm:px-6">
        {' '}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          {' '}
          <Link
            href="/account"
            className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-sm sm:flex"
          >
            {' '}
            <ChevronLeft className="flip-rtl size-3.5" /> Dashboard{' '}
          </Link>{' '}
          <div className="flex items-center gap-2.5">
            {' '}
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-white shadow-md">
              {' '}
              <Settings className="size-4" />{' '}
            </div>{' '}
            <div>
              {' '}
              <h1 className="text-sm font-semibold leading-none tracking-tight">Settings</h1>{' '}
              <p className="hidden text-xs text-muted-foreground sm:block">
                {activeSection
                  ? activeSection.label + ' · ' + activeSection.desc
                  : 'Manage your account & preferences'}
              </p>{' '}
            </div>{' '}
          </div>{' '}
          <button
            onClick={() => setSidebarOpen(true)}
            className="ms-auto flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted lg:hidden"
          >
            {' '}
            <Menu className="size-4" />{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
        {' '}
        {/* Desktop sidebar */}{' '}
        <aside className="hidden w-[280px] shrink-0 lg:block">
          {' '}
          <div className="sticky top-[148px] space-y-3">
            {' '}
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              {' '}
              <nav className="space-y-5">
                {' '}
                {sidebarSections.map((section) => (
                  <div key={section.label}>
                    {' '}
                    <p className="mb-2 flex items-center gap-2 px-2 text-2xs font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                      {' '}
                      <span className="h-px w-3 bg-border" /> {section.label}{' '}
                    </p>{' '}
                    <div className="space-y-1">
                      {' '}
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? 'bg-primary/10 text-primary ring-1 ring-primary/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                          >
                            {' '}
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground group-hover:bg-card group-hover:text-foreground group-hover:shadow-sm'}`}
                            >
                              {' '}
                              <item.icon className="size-3.5" />{' '}
                            </span>{' '}
                            <span className="min-w-0 flex-1">
                              {' '}
                              <span className="block truncate text-sm font-medium leading-none">
                                {item.label}
                              </span>{' '}
                              <span className="truncate text-2xs leading-none text-muted-foreground">
                                {item.desc}
                              </span>{' '}
                            </span>{' '}
                          </Link>
                        );
                      })}{' '}
                    </div>{' '}
                  </div>
                ))}{' '}
              </nav>{' '}
            </div>{' '}
            <div className="rounded-2xl border border-primary/10 bg-primary p-4 text-white shadow-lg">
              {' '}
              <div className="flex size-8 items-center justify-center rounded-xl bg-card">
                {' '}
                <Sparkles className="size-4" />{' '}
              </div>{' '}
              <p className="mt-3 text-sm font-semibold leading-tight">Need help?</p>{' '}
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                Check our docs or contact support for account assistance.
              </p>{' '}
              <Link
                href="/feed"
                className="mt-3 inline-flex rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-card"
              >
                {' '}
                Visit help center{' '}
              </Link>{' '}
            </div>{' '}
          </div>{' '}
        </aside>{' '}
        {/* Mobile overlay */}{' '}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}{' '}
        {/* Mobile drawer */}{' '}
        <aside
          className={`fixed inset-y-0 start-0 z-50 flex w-[300px] flex-col border-r bg-card shadow-sm transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {' '}
          <div className="flex items-center justify-between border-b px-4 py-3">
            {' '}
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="size-4 text-primary" /> Settings
            </span>{' '}
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-full p-2 hover:bg-muted"
            >
              <X className="size-4" />
            </button>{' '}
          </div>{' '}
          <nav className="flex-1 space-y-5 overflow-auto p-4">
            {' '}
            {sidebarSections.map((section) => (
              <div key={section.label}>
                {' '}
                <p className="mb-2 px-2 text-2xs font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {section.label}
                </p>{' '}
                <div className="space-y-1">
                  {' '}
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-primary/10 text-primary ring-1 ring-primary/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                      >
                        {' '}
                        <item.icon className="size-4" /> {item.label}{' '}
                      </Link>
                    );
                  })}{' '}
                </div>{' '}
              </div>
            ))}{' '}
          </nav>{' '}
        </aside>{' '}
        <main className="min-w-0 flex-1">{children}</main>{' '}
      </div>{' '}
    </div>
  );
}
