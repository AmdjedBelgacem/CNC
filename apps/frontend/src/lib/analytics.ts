/**
 * Vendor-agnostic analytics helpers.
 *
 * Pages call these helpers — never gtag/snaptr directly — so vendor wiring,
 * consent, and PII rules stay in one place.
 *
 * Resolution (set by AnalyticsProvider / root layout):
 *   tenant config → env (NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_SNAPCHAT_PIXEL_ID) → disabled
 *
 * Consent: no CMP yet. Default is allow-when-configured. A future CMP can
 * set localStorage `titan.analytics.consent` to `granted` | `denied` and this
 * module will respect it. Denied blocks loading + emissions.
 *
 * Privacy: never pass email, name, phone, or other PII into payloads.
 */

export type AnalyticsIds = {
  gaMeasurementId?: string | null;
  snapchatPixelId?: string | null;
};

export type FunnelEvent =
  | 'sign_up'
  | 'login'
  | 'enroll'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase';

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  quantity?: number;
  price?: number;
};

export type AnalyticsEventParams = {
  value?: number;
  currency?: string;
  transaction_id?: string;
  items?: AnalyticsItem[];
  method?: string;
  content_type?: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    snaptr?: (...args: unknown[]) => void;
    __titanAnalytics?: AnalyticsIds;
  }
}

const GA_MEASUREMENT_RE = /^G-[A-Z0-9]{4,}$/i;
const SNAP_PIXEL_RE = /^\d{5,}$/;

/** Strict validation used by admin UI and runtime guards. Empty string = disabled. */
export function isValidGaId(id: string): boolean {
  const v = id.trim();
  return v === '' || GA_MEASUREMENT_RE.test(v);
}

export function isValidSnapPixelId(id: string): boolean {
  const v = id.trim();
  return v === '' || SNAP_PIXEL_RE.test(v);
}

export function normalizeAnalyticsIds(input: Partial<AnalyticsIds> | null | undefined): AnalyticsIds {
  const ga = (input?.gaMeasurementId ?? '').trim();
  const snap = (input?.snapchatPixelId ?? '').trim();
  return {
    gaMeasurementId: GA_MEASUREMENT_RE.test(ga) ? ga : '',
    snapchatPixelId: SNAP_PIXEL_RE.test(snap) ? snap : '',
  };
}

/** Runtime allow check. True when no CMP has recorded a denial. */
export function isAnalyticsAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('titan.analytics.consent') !== 'denied';
  } catch {
    return true;
  }
}

/** Set by AnalyticsProvider so helpers work outside the provider tree. */
export function setRuntimeAnalyticsIds(ids: AnalyticsIds): void {
  if (typeof window === 'undefined') return;
  window.__titanAnalytics = normalizeAnalyticsIds(ids);
}

export function getRuntimeAnalyticsIds(): Required<AnalyticsIds> {
  const ids = normalizeAnalyticsIds(
    typeof window !== 'undefined' ? window.__titanAnalytics : undefined,
  );
  return {
    gaMeasurementId: ids.gaMeasurementId ?? '',
    snapchatPixelId: ids.snapchatPixelId ?? '',
  };
}

/** Map app funnel names → Snapchat standard events (null = no Snap equivalent). */
const SNAP_EVENT_MAP: Record<FunnelEvent, string | null> = {
  sign_up: 'SIGN_UP',
  login: null, // Snap has no clean LOGIN equivalent — GA only
  enroll: null, // custom funnel — GA only unless Snap event is registered
  add_to_cart: 'ADD_CART',
  begin_checkout: 'START_CHECKOUT',
  purchase: 'PURCHASE',
};

function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/**
 * Emit a funnel event to whichever tags are active. Fail-soft if SDK missing.
 * Safe to call before scripts finish loading (queued on dataLayer / snaptr queue).
 */
export function trackEvent(name: FunnelEvent, params: AnalyticsEventParams = {}): void {
  if (typeof window === 'undefined') return;
  if (!isAnalyticsAllowed()) return;
  const { gaMeasurementId, snapchatPixelId } = getRuntimeAnalyticsIds();

  // Strip anything that could be PII if callers pass extras.
  const safeParams: AnalyticsEventParams = { ...params };
  for (const key of Object.keys(safeParams)) {
    if (/email|phone|name\b|user_name|first_name|last_name/i.test(key)) {
      delete safeParams[key];
    }
  }

  if (gaMeasurementId) {
    try {
      window.gtag?.('event', name, safeParams);
    } catch {
      /* fail soft */
    }
  }

  const snapEvent = SNAP_EVENT_MAP[name];
  if (snapchatPixelId && snapEvent) {
    try {
      const snapPayload: Record<string, unknown> = {};
      if (typeof safeParams.value === 'number') snapPayload.value = safeParams.value;
      if (safeParams.currency) snapPayload.currency = safeParams.currency;
      if (safeParams.transaction_id) snapPayload.transactionId = safeParams.transaction_id;
      if (safeParams.items?.length) {
        // Snap expects content_ids / contents shapes when present
        snapPayload.contentIds = safeParams.items.map((i) => i.item_id);
        snapPayload.contents = safeParams.items.map((i) => ({
          id: i.item_id,
          quantity: i.quantity ?? 1,
          price: i.price,
        }));
        snapPayload.itemCount = safeParams.items.reduce((n, i) => n + (i.quantity ?? 1), 0);
      }
      window.snaptr?.('track', snapEvent, snapPayload);
    } catch {
      /* fail soft */
    }
  }

  // Always mirror to dataLayer for GTM/debugging when GA is present.
  if (gaMeasurementId) {
    pushDataLayer({ event: name, ...safeParams });
  }
}

/** GA4 page_view for SPA route changes (first load is handled by gtag config). */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isAnalyticsAllowed()) return;
  const { gaMeasurementId, snapchatPixelId } = getRuntimeAnalyticsIds();
  try {
    if (gaMeasurementId) {
      window.gtag?.('config', gaMeasurementId, { page_path: path });
    }
    if (snapchatPixelId) {
      window.snaptr?.('track', 'PAGE_VIEW', { pageUrl: window.location.origin + path });
    }
  } catch {
    /* fail soft */
  }
}

// ---- Convenience wrappers for call sites ----

export function trackSignUp(method: string = 'password'): void {
  trackEvent('sign_up', { method });
}

export function trackLogin(method: string = 'password'): void {
  trackEvent('login', { method });
}

export function trackEnroll(courseId: string, courseName?: string): void {
  trackEvent('enroll', {
    content_type: 'course',
    items: [
      {
        item_id: courseId,
        item_name: courseName || courseId,
        quantity: 1,
      },
    ],
  });
}

export function trackAddToCart(item: {
  productId: string;
  title: string;
  price: number; // cents in this app
  quantity?: number;
  /** Store currency. A SAR merchant reporting USD would not match its books. */
  currency?: string;
}): void {
  const priceDollars = item.price / 100;
  const quantity = item.quantity ?? 1;
  trackEvent('add_to_cart', {
    currency: item.currency ?? 'SAR',
    value: priceDollars * quantity,
    items: [
      {
        item_id: item.productId,
        item_name: item.title,
        quantity,
        price: priceDollars,
      },
    ],
  });
}

export function trackBeginCheckout(
  items: AnalyticsItem[],
  totalCents: number,
  currency = 'SAR',
): void {
  trackEvent('begin_checkout', {
    currency,
    value: totalCents / 100,
    items,
  });
}

export function trackPurchase(input: {
  transactionId: string;
  totalCents: number;
  /**
   * The currency the order was actually charged in. Defaulting to USD was wrong
   * for a SAR merchant: the revenue number would not match the books.
   */
  currency?: string;
  items?: AnalyticsItem[];
}): void {
  trackEvent('purchase', {
    currency: input.currency ?? 'SAR',
    value: input.totalCents / 100,
    transaction_id: input.transactionId,
    items: input.items ?? [],
  });
}
