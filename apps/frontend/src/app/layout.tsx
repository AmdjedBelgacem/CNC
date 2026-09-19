import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { EB_Garamond, Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import '@/styles/globals.css';
// Puck editor styles: vendored locally (see styles/puck.css) so the remote
// rsms.me font @import Puck ships doesn't block first paint on every page.
// Must live in the root layout, not the dynamic builder chunk (ChunkLoadError).
import '@/styles/puck.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { AuthHydration } from '@/components/auth/auth-hydration';
import { PWARegister } from '@/components/pwa/pwa-register';
import { PWAUpdateToast } from '@/components/pwa/update-toast';
import { PublicSearchPalette } from '@/components/search/public-search-palette';
import { MaterialSymbols } from '@/components/fonts/material-symbols';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { resolveThemeTokens } from '@/lib/builder/theme';
import { themeTokensToCss } from '@/lib/builder/theme-css';
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-garamond',
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
export const metadata: Metadata = {
  metadataBase: new URL('https://titansofmanufacturing.com'),
  title: { default: 'Machinist Pro | Master CNC Machining', template: '%s — Machinist Pro' },
  description: 'Professional manufacturing education platform for modern machinists and engineers.',
  openGraph: {
    title: 'Machinist Pro | Master CNC Machining',
    description:
      'Professional manufacturing education platform for modern machinists and engineers.',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Machinist Pro | Master CNC Machining',
    description:
      'Professional manufacturing education platform for modern machinists and engineers.',
  },
  icons: { icon: '/favicon.ico' },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const locale = await getLocale();
  const messages = await getMessages();
  const tokens = await resolveThemeTokens(tenantSlug);
  const themeCss = themeTokensToCss(tokens);
  return (
    <html
      lang={locale}
      className={`${outfit.variable} ${ebGaramond.variable} ${inter.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      
      <head>
        
        <link rel="icon" href="https://titansofmanufacturing.com/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={tokens.light.primary} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <MaterialSymbols />
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {/* Apply the stored colour mode before first paint. Dark mode is class-driven
            (Tailwind darkMode: 'class'), so without this the document renders light
            and then flips after hydration — a visible flash on every navigation. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('titans-color-mode');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.classList.toggle('light',!d);}catch(_){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-text-primary font-body-md antialiased overflow-x-hidden">
        
        <NextIntlClientProvider locale={locale} messages={messages}>
          
          <Suspense>
            <AnalyticsProvider GA_ID={process.env.NEXT_PUBLIC_GA_ID} />
          </Suspense>
          <QueryProvider>
            
            <ThemeProvider>
              
              <AuthHydration>{children}</AuthHydration>
            </ThemeProvider>
          </QueryProvider>
          {/* Global search palette — Cmd+K / header button */} <PublicSearchPalette />
          {/* PWA — production-only registration + update prompt */} <PWARegister />
          <PWAUpdateToast />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
