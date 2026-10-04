/**
 * Category filter <-> URL plumbing for the store.
 *
 * Kept out of the components so it can be reasoned about and tested without a
 * DOM, and so the department tiles and the catalog agree on one format instead
 * of each building a query string by hand.
 */

/** Sentinel for "no category filter". Not a real category name. */
export const ALL_CATEGORIES = 'all';

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

/**
 * Path for a category-filtered store URL.
 *
 * `category=all` (or blank) removes the parameter rather than writing
 * `category=all`, so the unfiltered store has one canonical URL. Any other
 * query parameters are preserved: switching department must not discard a
 * search term or a sort the shopper already chose.
 */
export function buildCategoryHref(
  pathname: string,
  search: string | null | undefined,
  category: string,
): string {
  const params = new URLSearchParams(search ?? '');
  const next = category.trim();
  if (!next || next === ALL_CATEGORIES) params.delete('category');
  else params.set('category', next);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}