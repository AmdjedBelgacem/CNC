import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import '@/styles/globals.css';
// Puck editor styles: vendored locally (see styles/puck.css) so the remote
// rsms.me font @import Puck ships doesn't block first paint on every page.
// Must live in the root layout, not the dynamic builder chunk (ChunkLoadError).
import '@/styles/puck.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { MotionProvider } from '@/components/providers/motion-provider';
import { MediaLoadProvider } from '@/components/providers/media-load-provider';
import { NotificationSocketProvider } from '@/components/providers/notification-socket-provider';
import { BRAND_NAME, OG_IMAGE, SITE_URL } from '@/lib/brand';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { AuthHydration } from '@/components/auth/auth-hydration';
import { PWARegister } from '@/components/pwa/pwa-register';
import { PWAUpdateToast } from '@/components/pwa/update-toast';
import { PublicSearchPalette } from '@/components/search/public-search-palette';
import { AiAssistantProvider } from '@/components/ai/ai-assistant-context';
import { PublicAiAssistant } from '@/components/ai/ai-assistant-widget';
import { ToastViewport } from '@/components/ui/toast';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { resolveThemeTokens } from '@/lib/builder/theme';
import { themeTokensToCss } from '@/lib/builder/theme-css';
import { resolveAnalyticsIds } from '@/lib/analytics-config';
import { coerceLocale, dirFor } from '@/i18n/config';
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
export const metadata: Metadata = {
  // One origin for the whole public surface. This was hardcoded to
  // https://titansofmanufacturing.com while the site served from a Vercel host, so the
  // homepage canonicalised to an origin that was not the one answering — every signal
  // about which URL is authoritative pointed somewhere else.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} | CNC Machining Courses & Certification`,
    // A single trailing brand segment. The old template appended "— Baroot CNC Solutions" to
    // titles that already contained it, producing
    // "Baroot CNC Solutions | Master CNC Machining — Baroot CNC Solutions".
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    'Baroot CNC Solutions delivers CNC machining courses, simulation-first training and industry-recognised certification for machinists, engineers and manufacturing teams.',
  applicationName: BRAND_NAME,
  openGraph: {
    title: `${BRAND_NAME} | CNC Machining Courses & Certification`,
    description:
      'CNC machining courses, simulation-first training and industry-recognised certification for machinists, engineers and manufacturing teams.',
    type: 'website',
    locale: 'en_US',
    siteName: BRAND_NAME,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} | CNC Machining Courses & Certification`,
    description:
      'CNC machining courses, simulation-first training and industry-recognised certification for machinists, engineers and manufacturing teams.',
    images: [OG_IMAGE.url],
  },
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const rawLocale = await getLocale();
  const locale = coerceLocale(rawLocale);
  const dir = dirFor(locale);
  const messages = await getMessages();
  const tokens = await resolveThemeTokens(tenantSlug);
  const themeCss = themeTokensToCss(tokens);
  // tenant → env → disabled (empty = no tags)
  const analytics = await resolveAnalyticsIds(tenantSlug);
  // Cookie-first color mode: ThemeProvider writes `titans:color-mode` so the
  // server can bake dark/light onto <html> without an executable head script.
  // 'system' or missing → leave the default (light) class off; ThemeProvider
  // resolves OS preference after mount.
  const colorMode = cookieStore.get('titans:color-mode')?.value;
  const htmlClass = [
    spaceGrotesk.variable,
    inter.variable,
    jetBrainsMono.variable,
    colorMode === 'dark' ? 'dark' : colorMode === 'light' ? 'light' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <html
      lang={locale}
      dir={dir}
      // globals.css sets `scroll-behavior: smooth`; without this attribute Next
      // warns and cannot suppress smooth scrolling during route transitions.
      data-scroll-behavior="smooth"
      className={htmlClass}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={tokens.light.primary} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        {/* Tenant published theme (server-rendered). User overrides are appended
            later by ThemeProvider so they win the cascade. */}
        <style
          id="tenant-theme-tokens"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased overflow-x-hidden">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MediaLoadProvider>
            <Suspense>
              <AnalyticsProvider
                gaMeasurementId={analytics.gaMeasurementId}
                snapchatPixelId={analytics.snapchatPixelId}
              />
            </Suspense>
            <QueryProvider>
              <MotionProvider>
                <NotificationSocketProvider>
                  <ThemeProvider>
                    <AiAssistantProvider>
                      <AuthHydration>{children}</AuthHydration>
                      <PublicAiAssistant />
                      <PublicSearchPalette />
                    </AiAssistantProvider>
                  </ThemeProvider>
                </NotificationSocketProvider>
              </MotionProvider>
            </QueryProvider>
            {/* Toasts are app-wide, not just admin. */}
            <ToastViewport />
            {/* PWA — production-only registration + update prompt */}
            <PWARegister />
            <PWAUpdateToast />
          </MediaLoadProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
