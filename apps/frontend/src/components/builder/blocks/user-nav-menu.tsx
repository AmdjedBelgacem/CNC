'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, LayoutTemplate, LogOut, Settings, Shield, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client'; /** Avatar + dropdown menu shown in the navbar when a user is signed in. */
export function UserNavMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const isAdmin =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    !!user?.tenantRoles?.some((r) => r.role === 'super_admin' || r.role === 'admin');
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
    } finally {
      logout();
      setOpen(false);
      router.push('/');
    }
  };
  const initial =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className="relative" ref={menuRef}>
      {' '}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md ring-2 ring-white transition hover:shadow-lg hover:scale-[1.02] dark:ring-ring"
      >
        {' '}
        {initial}{' '}
      </button>{' '}
      {open && (
        <div className="absolute end-0 top-full mt-2 w-[260px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm z-50 dark:border-border dark:bg-overlay animate-popover-in [--popover-origin:top]">
          {' '}
          {/* Header — compact */}{' '}
          <div className="flex gap-2.5 px-4 pb-3 pt-4">
            {' '}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow-sm">
              {' '}
              {initial}{' '}
            </div>{' '}
            <div className="min-w-0 flex-1">
              {' '}
              <p className="truncate text-sm font-semibold leading-none text-foreground dark:text-foreground">
                {user?.name || 'User'}
              </p>{' '}
              <p className="mt-0.5 truncate text-xs leading-none text-muted-foreground dark:text-muted-foreground">
                {user?.email}
              </p>{' '}
              <span className="mt-1.5 inline-flex rounded-full bg-overlay px-1.5 py-0.5 text-2xs font-medium text-white dark:bg-card dark:text-foreground">
                {' '}
                {user?.role?.replace('_', ' ') || 'Member'}{' '}
              </span>{' '}
            </div>{' '}
          </div>{' '}
          <div className="px-1.5 pb-1">
            {' '}
            <Link
              href={`/profile/${user?.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-sunken dark:hover:bg-popover"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary">
                {' '}
                <User className="size-3.5" />{' '}
              </span>{' '}
              <span className="flex-1 text-sm font-medium text-secondary dark:text-foreground">
                Profile
              </span>{' '}
            </Link>{' '}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-sunken dark:hover:bg-popover"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-success/10 text-success dark:bg-success/15 dark:text-success">
                {' '}
                <BookOpen className="size-3.5" />{' '}
              </span>{' '}
              <span className="flex-1 text-sm font-medium text-secondary dark:text-foreground">
                My learning
              </span>{' '}
            </Link>{' '}
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-surface-sunken dark:text-muted-foreground dark:hover:bg-popover"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-popover dark:text-muted-foreground">
                {' '}
                <Settings className="size-3.5" />{' '}
              </span>{' '}
              Settings{' '}
            </Link>{' '}
            <Link
              href="/settings/account/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-surface-sunken dark:text-muted-foreground dark:hover:bg-popover"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-secondary dark:border-border-strong dark:bg-popover dark:text-muted-foreground">
                {' '}
                <Shield className="size-3.5" />{' '}
              </span>{' '}
              Security{' '}
            </Link>{' '}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground hover:border-primary   dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground"
              >
                {' '}
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                  {' '}
                  <LayoutTemplate className="size-3.5" />{' '}
                </span>{' '}
                Admin Dashboard{' '}
              </Link>
            )}{' '}
          </div>{' '}
          <div className="border-t border-border p-1.5 dark:border-border">
            {' '}
            <button
              onClick={() => void handleLogout()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-sunken hover:text-foreground dark:text-muted-foreground dark:hover:bg-popover dark:hover:text-foreground"
            >
              {' '}
              <LogOut className="size-3.5" /> Sign out{' '}
            </button>{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
