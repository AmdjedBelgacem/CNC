/**
 * Consent gate stub for analytics.
 *
 * Default (no CMP yet): allow when tags are configured — see docs/ANALYTICS.md.
 * A future CMP should call `setAnalyticsConsent('granted' | 'denied')` (or write
 * the same localStorage key) before/when the user chooses.
 *
 * Key: titan.analytics.consent
 * Values: 'granted' | 'denied' | absent (default allow)
 */

const KEY = 'titan.analytics.consent';

export type AnalyticsConsent = 'granted' | 'denied' | 'default';

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'default';
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {
    /* private mode etc. */
  }
  return 'default';
}

export function setAnalyticsConsent(consent: 'granted' | 'denied' | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (consent === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, consent);
  } catch {
    /* ignore */
  }
}

/** True when analytics may run (default allow until a CMP records denial). */
export function analyticsConsentAllows(): boolean {
  return getAnalyticsConsent() !== 'denied';
}
