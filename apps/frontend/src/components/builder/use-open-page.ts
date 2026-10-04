'use client';

/**
 * Which page the builder is editing.
 *
 * The URL is the ONLY source of truth. There is no store copy, and no second
 * place to keep in step.
 *
 * Three attempts failed before this, all with the same underlying mistake —
 * keeping the open page in two places and reconciling them:
 *
 *   1. The header wrote a zustand slug while the editor kept its own `useState`
 *      copy, so switching pages did nothing at all.
 *   2. Unified on the store. Any reload or Fast Refresh re-evaluated the store
 *      module and reset it to its `home` default, so the canvas silently
 *      returned to the homepage.
 *   3. Added the URL and a "restore once" ref. React Refresh *preserves* hook
 *      state, so the ref survived the rebuild, the restore never ran again, and
 *      the page still snapped back until a hard reload.
 *
 * A URL is not reset by a module rebuild, survives a hard refresh, makes a page
 * linkable, and gives the browser Back button something honest to do. A store
 * value does none of those. So there is no store value.
 *
 * `openPage` deliberately does not read the current param: depending on
 * `useSearchParams()` would give it a new identity on every navigation, and the
 * editor's `load` callback depends on it — so every navigation would rebuild
 * `load` and refetch the page.
 */

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export const BUILDER_BASE_PATH = '/admin/builder';
export const PAGE_PARAM = 'page';
export const DEFAULT_PAGE_SLUG = 'home';

export function builderPageHref(slug: string) {
  // The default page gets the bare path, so `/admin/builder` stays canonical
  // instead of acquiring `?page=home`.
  if (!slug || slug === DEFAULT_PAGE_SLUG) return BUILDER_BASE_PATH;
  return `${BUILDER_BASE_PATH}?${PAGE_PARAM}=${encodeURIComponent(slug)}`;
}

export function useOpenPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onBuilder = pathname === BUILDER_BASE_PATH;
  const currentFromUrl = onBuilder ? searchParams.get(PAGE_PARAM) : null;
  const slug = currentFromUrl || DEFAULT_PAGE_SLUG;

  const openPage = useCallback(
    (next: string) => {
      if (!next) return;
      router.replace(builderPageHref(next), { scroll: false });
    },
    [router],
  );

  return { slug, openPage, currentFromUrl, onBuilder };
}
