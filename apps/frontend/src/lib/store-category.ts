/**
 * Category filter <-> URL plumbing for the store.
 *
 * Kept out of the components so it can be reasoned about and tested without a
 * DOM, and so the department tiles and the catalog agree on one format instead
 * of each building a query string by hand.
 */

/** Sentinel for "no category filter". Not a real category name. */
export const ALL_CATEGORIES = 'all';

/** Sentinel for "no product-type filter". Not a real type name. */
export const ALL_TYPES = 'all';

/**
 * The category named by a query string, or `ALL_CATEGORIES`.
 *
 * A blank or repeated `?category=` is treated as no filter, so a hand-edited
 * URL degrades to the full catalog instead of an empty grid.
 */
export function readCategoryFromSearch(search: string | null | undefined): string {
  const raw = new URLSearchParams(search ?? '').get('category')?.trim();
  return raw ? raw : ALL_CATEGORIES;
}

/** The product type named by a query string, or `ALL_TYPES`. */
export function readTypeFromSearch(search: string | null | undefined): string {
  const raw = new URLSearchParams(search ?? '').get('type')?.trim();
  return raw ? raw : ALL_TYPES;
}

/**
 * Path for a category-filtered store URL.
 *
 * `category=all` (or blank) removes the parameter rather than writing
 * `category=all`, so the unfiltered store has one canonical URL. Any other
 * query parameters are preserved: switching department must not discard a
 * search term or a sort the shopper already chose.
 *
 * `clearType` is set when the shopper switches department. A type belongs to
 * one category (a "Collet System" is not a "Laser Cutting Machine"), so keeping
 * the old type would produce an empty grid with no visible cause.
 */
export function buildCategoryHref(
  pathname: string,
  search: string | null | undefined,
  category: string,
  opts?: { clearType?: boolean },
): string {
  const params = new URLSearchParams(search ?? '');
  const next = category.trim();
  if (!next || next === ALL_CATEGORIES) params.delete('category');
  else params.set('category', next);
  if (opts?.clearType) params.delete('type');
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Path for a product-type-filtered store URL, preserving category/search/sort. */
export function buildTypeHref(
  pathname: string,
  search: string | null | undefined,
  type: string,
): string {
  const params = new URLSearchParams(search ?? '');
  const next = type.trim();
  if (!next || next === ALL_TYPES) params.delete('type');
  else params.set('type', next);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}