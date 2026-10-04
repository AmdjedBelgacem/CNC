/** Human-readable relative time, localised and direction-agnostic. */
export function timeAgo(date: string | number | Date, locale = 'en'): string {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, (Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (sec < 60) return rtf.format(-Math.floor(sec), 'second');
  const min = sec / 60;
  if (min < 60) return rtf.format(-Math.floor(min), 'minute');
  const hr = min / 60;
  if (hr < 24) return rtf.format(-Math.floor(hr), 'hour');
  const day = hr / 24;
  if (day < 30) return rtf.format(-Math.floor(day), 'day');
  const month = day / 30;
  if (month < 12) return rtf.format(-Math.floor(month), 'month');
  return rtf.format(-Math.floor(month / 12), 'year');
}

export function formatDate(
  date: string | number | Date | null | undefined,
  locale = 'en',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(date: string | number | Date | null | undefined, locale = 'en') {
  return formatDate(date, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatNumber(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCompact(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    if (first && second) return (first + second).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
