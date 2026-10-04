'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { setRuntimeAnalyticsIds, trackPageView, normalizeAnalyticsIds } from '@/lib/analytics';
import { analyticsConsentAllows } from '@/lib/analytics-consent';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    snaptr?: (...args: unknown[]) => void;
  }
}

type Props = {
  gaMeasurementId?: string | null;
  snapchatPixelId?: string | null;
};

/**
 * Loads GA4 + Snapchat Pixel only when IDs are configured (tenant → env → off).
 * SSR-safe: scripts render only when IDs exist, so server HTML and first client
 * render match. Never blocks rendering; events fail soft if SDKs are missing.
 *
 * Consent: default allow-when-configured (no CMP yet). If localStorage records
 * `denied`, scripts are omitted after mount and emissions are suppressed.
 */
export function AnalyticsProvider({ gaMeasurementId, snapchatPixelId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ids = normalizeAnalyticsIds({ gaMeasurementId, snapchatPixelId });
  const hasGa = Boolean(ids.gaMeasurementId);
  const hasSnap = Boolean(ids.snapchatPixelId);
  const enabled = hasGa || hasSnap;

  useEffect(() => {
    if (!enabled) return;
    setRuntimeAnalyticsIds(ids);
    if (!analyticsConsentAllows()) return;
    const qs = searchParams?.toString();
    const url = pathname + (qs ? `?${qs}` : '');
    trackPageView(url);
    // ids fields are primitives; safe as deps
  }, [enabled, hasGa, hasSnap, pathname, searchParams, ids.gaMeasurementId, ids.snapchatPixelId]);

  if (!enabled) return null;
  if (typeof window !== 'undefined' && !analyticsConsentAllows()) return null;

  return (
    <>
      {hasGa && (
        <>
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${ids.gaMeasurementId}`}
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ids.gaMeasurementId}');`,
            }}
          />
        </>
      )}
      {hasSnap && (
        <>
          <Script
            id="snap-pixel-loader"
            strategy="afterInteractive"
            src="https://sc-static.net/sce.min.js"
          />
          <Script
            id="snap-pixel-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.snaptr=window.snaptr||function(){(window.snaptr.q=window.snaptr.q||[]).push(arguments)};snaptr('init','${ids.snapchatPixelId}');snaptr('track','PAGE_VIEW');`,
            }}
          />
        </>
      )}
    </>
  );
}
