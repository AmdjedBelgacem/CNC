'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
declare global {
  interface Window {
    gtag?: (command: string, id: string, config?: Record<string, string>) => void;
    dataLayer?: unknown[];
  }
}
export function AnalyticsProvider({ GA_ID }: { GA_ID?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    window.gtag?.('config', GA_ID, { page_path: url });
  }, [GA_ID, pathname, searchParams]);
  if (!GA_ID) return null;
  return (
    <>
      {' '}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />{' '}
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: ` window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA_ID}', { page_path: window.location.pathname }); `,
        }}
      />{' '}
    </>
  );
}
