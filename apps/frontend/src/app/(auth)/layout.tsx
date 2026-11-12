import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/layout/brand';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Every route in this group is an authentication or credential-verification screen:
 * /login, /register, /forgot-password, /reset-password, /2fa, /verify-email.
 *
 * None of them should be indexed. They shipped `index, follow` and a generic
 * "Professional manufacturing education platform…" description, which meant search
 * engines could rank a login form as a page describing the business — and the login page
 * ended up with the *same* `<title>` as a course detail page, making the two compete.
 *
 * Set here rather than per page because every screen in the group is a client component,
 * and only a server layout can export `metadata`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chrome.auth');
  return {
    // The template used to end in "Sign in" instead of the brand, so every screen read like the
    // login page. Each screen now names itself and the brand follows, like everywhere else.
    title: { default: t('signIn'), template: `%s | ${BRAND_NAME}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

const PERK_KEYS = ['progress', 'certificates', 'orders', 'languages'] as const;

/**
 * Split layout from the "Public site" design on the Claude Design canvas: a brand panel that says
 * what an account gives you, and the form on the other half. The panel steps aside on phones so
 * the form is the first thing on screen.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('chrome.auth');
  return (
    <div className="relative grid min-h-screen bg-background lg:grid-cols-2">
      <a
        href="#main"
        className="sr-only z-[100] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        {t('skip')}
      </a>

      <aside
        aria-label={t('aboutLabel', { brand: BRAND_NAME })}
        className="relative hidden flex-col justify-between overflow-hidden border-e border-border/70 bg-surface-sunken px-12 py-12 lg:flex xl:px-14"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_600px_at_0%_100%,rgb(var(--c-primary)/0.26),transparent_60%)]"
        />
        {/* BrandMark is already a link home; wrapping it nested one <a> inside another. */}
        <div className="relative w-fit">
          <BrandMark />
        </div>

        <div className="relative max-w-[480px]">
          <p className="text-balance font-display text-[44px] font-medium leading-[1.08] tracking-[-0.02em] text-foreground xl:text-5xl">
            {t.rich('panel.headline', {
              accent: (chunks) => <em className="text-primary">{chunks}</em>,
            })}
          </p>
          <ul className="mt-8 space-y-5">
            {PERK_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
                  <Check className="size-4" strokeWidth={2.25} aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{t(`panel.perks.${key}.title`)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t(`panel.perks.${key}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex max-w-[420px] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />
          {t('panel.session')}
        </p>
      </aside>

      <div className="relative flex min-h-screen flex-col px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <span aria-hidden className="inline-block rtl:-scale-x-100">&larr;</span> {t('back')}
          </Link>
          <span className="lg:hidden">
            <BrandMark compact />
          </span>
        </div>
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 focus:outline-none">
          {children}
        </main>
        <footer className="pb-1 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {BRAND_NAME}
        </footer>
      </div>
    </div>
  );
}
