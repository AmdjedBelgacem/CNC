'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, LayoutTemplate, LogOut, Settings, Shield, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client'; /** Avatar + dropdown menu shown in the navbar when a user is signed in. */
export function UserNavMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
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
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-md ring-2 ring-white transition hover:shadow-lg hover:scale-[1.02] dark:ring-zinc-900"
      >
        {' '}
        {initial}{' '}
      </button>{' '}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[260px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm z-50 dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in slide-in-from-top-1 duration-150">
          {' '}
          {/* Header — compact */}{' '}
          <div className="flex gap-2.5 px-4 pb-3 pt-4">
            {' '}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
              {' '}
              {initial}{' '}
            </div>{' '}
            <div className="min-w-0 flex-1">
              {' '}
              <p className="truncate text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-100">
                {user?.name || 'User'}
              </p>{' '}
              <p className="mt-0.5 truncate text-xs leading-none text-zinc-500 dark:text-zinc-400">
                {user?.email}
              </p>{' '}
              <span className="mt-1.5 inline-flex rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-zinc-900">
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
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                {' '}
                <User className="h-3.5 w-3.5" />{' '}
              </span>{' '}
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Profile
              </span>{' '}
            </Link>{' '}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                {' '}
                <BookOpen className="h-3.5 w-3.5" />{' '}
              </span>{' '}
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                My learning
              </span>{' '}
            </Link>{' '}
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {' '}
                <Settings className="h-3.5 w-3.5" />{' '}
              </span>{' '}
              Settings{' '}
            </Link>{' '}
            <Link
              href="/settings/account/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {' '}
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {' '}
                <Shield className="h-3.5 w-3.5" />{' '}
              </span>{' '}
              Security{' '}
            </Link>{' '}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-2.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-600 hover:text-white hover:border-violet-600 dark:border-violet-900/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-600 dark:hover:text-white"
              >
                {' '}
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm">
                  {' '}
                  <LayoutTemplate className="h-3.5 w-3.5" />{' '}
                </span>{' '}
                Admin Dashboard{' '}
              </Link>
            )}{' '}
          </div>{' '}
          <div className="border-t border-zinc-100 p-1.5 dark:border-zinc-800">
            {' '}
            <button
              onClick={() => void handleLogout()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {' '}
              <LogOut className="h-3.5 w-3.5" /> Sign out{' '}
            </button>{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
