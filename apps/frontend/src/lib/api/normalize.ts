/**
 * The backend is not perfectly uniform: some endpoints return a bare array,
 * others `{ items: [] }` or `{ data: [] }`. Components should not have to know
 * which, so every list goes through here before it is rendered.
 */
export function toList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.items)) return v.items as T[];
    if (Array.isArray(v.data)) return v.data as T[];
    if (Array.isArray(v.results)) return v.results as T[];
  }
  return [];
}

export function toTotal(value: unknown, fallback?: number): number {
  const list = toList(value);
  if (typeof fallback === 'number') return fallback;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.total === 'number') return v.total;
  }
  return list.length;
}

/** Money is stored in minor units (cents) on products and courses. */
export function formatMoney(
  amount: number | null | undefined,
  currency = 'USD',
  locale = 'en',
): string {
  const value = typeof amount === 'number' ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value / 100);
  } catch {
    return `${currency} ${(value / 100).toFixed(2)}`;
  }
}

/** `videoDuration` is seconds. */
export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
