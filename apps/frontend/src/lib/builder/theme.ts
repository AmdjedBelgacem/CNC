import { DEFAULT_THEME_TOKENS, getDefaultLayout } from '@titan/shared';
import type { PageLayout, ThemeTokens } from '@titan/shared';
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
