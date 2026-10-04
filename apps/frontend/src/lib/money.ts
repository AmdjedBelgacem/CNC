import {
  DEFAULT_CURRENCY,
  currencyFractionDigits,
  isCurrencyCode,
  type CurrencyCode,
} from '@titan/shared';

/**
 * Currencies offered in the storefront switcher. SAR leads because it is the
 * workspace's primary currency; the rest cover the Gulf region and the markets
 * the shop actually ships to. The admin pricing form still lists every ISO code.
 */
export const STOREFRONT_CURRENCIES: CurrencyCode[] = [
  'SAR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'QAR',
  'KWD',
  'BHD',
  'OMR',
  'JOD',
  'EGP',
  'TRY',
  'INR',
  'PKR',
  'CNY',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
  'ZAR',
];

export function coerceCurrency(value: unknown, fallback: CurrencyCode = DEFAULT_CURRENCY): CurrencyCode {
  if (isCurrencyCode(value)) return value;
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  return isCurrencyCode(upper) ? upper : fallback;
}

type Rates = Record<string, number> | null | undefined;

/**
 * Converts an amount held in minor units (cents) from one currency to another
 * using rates quoted against a single base (SAR). Returns the input untouched
 * when either rate is unknown, so a missing rate never corrupts a price.
 */
export function convertMinorUnits(
  minor: number | null | undefined,
  from: string | null | undefined,
  to: CurrencyCode,
  rates: Rates,
): number {
  if (minor == null || !Number.isFinite(minor)) return 0;
  const source = coerceCurrency(from);
  if (source === to) return Math.round(minor);

  const fromRate = rates?.[source];
  const toRate = rates?.[to];
  if (!fromRate || !toRate) return Math.round(minor);

  const major = minor / 10 ** currencyFractionDigits(source);
  return Math.round(major * (toRate / fromRate) * 10 ** currencyFractionDigits(to));
}

/** True when a price would need converting but no rate is available yet. */
export function needsConversion(from: string | null | undefined, to: CurrencyCode, rates: Rates) {
  const source = coerceCurrency(from);
  if (source === to) return false;
  return !(rates?.[source] && rates?.[to]);
}

/**
 * Formats minor units in the given currency. Latin digits are pinned so Gulf
 * prices stay scannable in the Arabic UI.
 */
export function formatMinorUnits(
  minor: number | null | undefined,
  currency: CurrencyCode,
  locale: string,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
): string {
  const digits = currencyFractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    minimumFractionDigits: options?.minimumFractionDigits ?? digits,
    maximumFractionDigits: options?.maximumFractionDigits ?? digits,
  }).format((minor ?? 0) / 10 ** digits);
}

export function currencySymbol(currency: CurrencyCode, locale: string): string {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency, numberingSystem: 'latn' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}
