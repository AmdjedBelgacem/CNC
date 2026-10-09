import { DEFAULT_THEME_TOKENS, getDefaultLayout } from '@titan/shared';
import type { PageLayout, ThemeTokens } from '@titan/shared';
import { serverApiUrl } from '../server-api-url';

/**
 * Server-side origin for builder/content calls.
 *
 * This is used only from server components and server-side fetchers (theme tokens, CMS
 * pages, navigation, analytics config), never from the browser, so it must resolve the
 * *internal* address. `NEXT_PUBLIC_API_URL` is the public API origin: pointing a server
 * render at it asks the public host for an internal path, gets a 404, and the caller
 * usually swallows the error — which is how the primary navigation went missing without a
 * single error in the logs.
 *
 * This must go through `serverApiUrl()` like every other server-side fetcher. It used to
 * spell the fallback chain out itself and, in doing so, skipped `API_URL` — the only variable
 * the deployed container sets. On the Lightsail stack `API_URL=http://backend:4000` while
 * `NEXT_PUBLIC_API_URL` is blank, so this resolved to `http://localhost:4000`, the frontend
 * container's own loopback, where nothing listens. Every builder fetch raised ECONNREFUSED
 * and was swallowed by `catch { return null }`, which is why the admin builder appeared
 * totally disconnected from the website: `/[slug]` called `notFound()` and the fixed routes
 * silently rendered hardcoded seed JSX instead of the pages the admin had actually built.
 *
 * `lib/products.ts` carries the same note for the same bug; this module was simply missed
 * during that migration.
 */
export const API_BASE = serverApiUrl();
/** Every backend call is tenant-scoped by header, never by a path segment. */
export function tenantHeaders(tenantSlug: string): HeadersInit {
  return { 'x-tenant-slug': tenantSlug };
} /** Server-side fetch of the published theme tokens for a tenant. */
export async function fetchPublishedTheme(tenantSlug: string): Promise<ThemeTokens | null> {
  try {
    const res = await fetch(`${API_BASE}/content/themes/current`, {
      headers: tenantHeaders(tenantSlug),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tokens?: ThemeTokens };
    if (!data.tokens) return null;
    return data.tokens;
  } catch {
    return null;
  }
} /** Server-side fetch of a published page layout; null when nothing is published. */
export async function fetchPublishedLayout(
  tenantSlug: string,
  slug: string,
): Promise<PageLayout | null> {
  try {
    const res = await fetch(`${API_BASE}/content/pages/${slug}`, {
      headers: tenantHeaders(tenantSlug),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { layout?: PageLayout };
    if (!data.layout) return null;
    return data.layout;
  } catch {
    return null;
  }
} /** Builds the final layout used for public rendering: published layout, else the hardcoded default. */
export async function resolvePageLayout(tenantSlug: string, slug: string): Promise<PageLayout> {
  const published = await fetchPublishedLayout(tenantSlug, slug);
  return published ?? getDefaultLayout(slug);
} /** Theme used for public rendering: published tokens, else the built-in defaults. */
export async function resolveThemeTokens(tenantSlug: string): Promise<ThemeTokens> {
  const published = await fetchPublishedTheme(tenantSlug);
  return published ?? DEFAULT_THEME_TOKENS;
}
