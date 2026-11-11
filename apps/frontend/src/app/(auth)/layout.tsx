import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
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
export const metadata: Metadata = {
  // The template used to end in "Sign in" instead of the brand, so every screen read like the
  // login page. Each screen now names itself and the brand follows, like everywhere else.
  title: {
    default: 'Sign in',
    template: `%s | ${BRAND_NAME}`,
  },
  robots: { index: false, follow: false, nocache: true },
};

const HIGHLIGHTS: [string, string][] = [
  ['Academic', 'Structured CNC curriculum from fundamentals to advanced'],
  ['Hands-on', 'Real-world projects with toolpath simulations'],
  ['Certified', 'Industry-recognized CNC certifications'],
  ['Community', 'Connect with machinists and instructors worldwide'],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Paper: a faint dot field under a warm clay/sage bloom. Purely decorative. */}
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-50" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[70vh] ambient-wash" aria-hidden />
      {/* Same skip link as the main layout: this group has no site navigation, but the
          brand, back link and highlights panel still precede the form in the tab order. */}
      <a
        href="#main"
        className="sr-only z-[100] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            &larr; Back
          </Link>
          <BrandMark compact />
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="grid w-full items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20 xl:gap-28">
            {/*
              `main` and `footer` landmarks were missing from every screen in this group,
              so a screen-reader user had no way to skip past the panel and reach the form:
              these routes rendered a bare div tree with no landmark structure at all.
              The aside is complementary, so it sits outside `main` rather than inside it.
            */}
            <aside
              aria-label="About Baroot CNC Solutions"
              className="hidden animate-fade-in-up lg:order-none lg:block"
            >
              <div className="max-w-md">
                <p id="platform-highlights" className="eyebrow">Platform Highlights</p>
                <p className="mt-5 text-balance font-display text-[44px] font-medium leading-[1.04] tracking-[-0.025em] text-foreground xl:text-[52px]">
                  Baroot <br /> CNC Solutions
                </p>
                <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                  Expert-led CNC manufacturing education, professional certifications, and a
                  community of modern machinists.
                </p>
                <div className="hairline mt-9 max-w-sm" aria-hidden />
                <div className="mt-8">
                <ul className="space-y-3" aria-labelledby="platform-highlights">
                  {HIGHLIGHTS.map(([title, desc]) => (
                    <li key={title} className="group flex gap-3.5 py-1">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
                        <Check className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                          {desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </aside>

            <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[440px] rounded-2xl border border-border/70 bg-card p-7 shadow-sm ring-1 ring-black/[0.015] focus:outline-none dark:ring-white/[0.03] sm:p-10 lg:mx-0"
            >
              <div className="flex min-h-[420px] flex-col">{children}</div>
            </main>
          </div>
        </div>

        <footer className="pb-1 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Baroot CNC Solutions
        </footer>
      </div>
    </div>
  );
}
