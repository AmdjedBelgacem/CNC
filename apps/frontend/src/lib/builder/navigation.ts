import { cookies } from 'next/headers';
import type { NavItemView } from '@titan/shared';
import { API_BASE, tenantHeaders } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

/**
 * The tenant's navigation tree, fetched on the server for a public layout.
 *
 * Server-side so the navbar is correct in the first HTML frame. A client fetch
 * would render the hardcoded fallback links first and then swap them, which
 * looks like a bug to a visitor and is jarring in Arabic where the swap moves
 * text position.
 *
 * A failed fetch degrades to an empty tree rather than to hardcoded links: the
 * admin has said what the menu is, and a stale hardcoded menu is worse than a
 * menu that fails closed. The nav editor surfaces the error instead.
 */
export async function fetchNavigation(
  tenantSlug: string,
  locale: 'en' | 'ar',
): Promise<NavItemView[]> {
  try {
    const res = await fetch(`${API_BASE}/content/navigation?locale=${locale}`, {
      headers: { ...tenantHeaders(tenantSlug), Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as NavItemView[]) : [];
  } catch {
    return [];
  }
}

/** Reads the tenant + locale the current request is for. */
export async function getNavContext(): Promise<{ tenantSlug: string; locale: 'en' | 'ar' }> {
  const store = await cookies();
  return {
    tenantSlug: store.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG,
    locale: store.get('locale')?.value === 'ar' ? 'ar' : 'en',
  };
}
