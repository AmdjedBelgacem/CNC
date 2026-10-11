import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { BrandMark } from '@/components/layout/brand';

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
  title: {
    default: 'Sign in',
    template: '%s | Sign in',
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
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-60" aria-hidden />
      {/* Same skip link as the main layout: this group has no site navigation, but the
          brand, back link and highlights panel still precede the form in the tab order. */}
      <a
        href="#main"
        className="sr-only z-[100] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary"
          >
            &larr; Back
          </Link>
          <BrandMark compact />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="corner-ticks relative w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
            <div className="flex">
              {/*
                `main` and `footer` landmarks were missing from every screen in this group,
                so a screen-reader user had no way to skip past the panel and reach the form:
                these routes rendered a bare div tree with no landmark structure at all.
                The aside is complementary, so it sits outside `main` rather than inside it.
              */}
              <main id="main" tabIndex={-1} className="min-h-[520px] flex-1 p-8 sm:p-10 focus:outline-none">
                {children}
              </main>

              <div className="hidden w-px shrink-0 bg-border lg:block" aria-hidden />

              <aside
                aria-label="About Baroot CNC Solutions"
                className="hidden w-[420px] shrink-0 lg:flex lg:flex-col"
              >
                <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-14">
                  <BrandMark />
                  <p className="mt-6 text-center font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
                    Baroot <br /> CNC Solutions
                  </p>
                  <div className="mt-5 h-0.5 w-14 bg-primary" aria-hidden />
                  <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
                    Expert-led CNC manufacturing education, professional certifications, and a
                    community of modern machinists.
                  </p>
                </div>

                <div className="relative mx-10 border-t border-border" />

                <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-14">
                  <div className="space-y-4">
                    <p className="text-center font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                      Platform Highlights
                    </p>
                    <ul className="space-y-3" aria-labelledby="platform-highlights">
                      {HIGHLIGHTS.map(([title, desc]) => (
                        <li key={title} className="group flex gap-3">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          <div>
                            <p className="text-13 font-semibold text-foreground">{title}</p>
                            <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <footer className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          &copy; {new Date().getFullYear()} Baroot CNC Solutions
        </footer>
      </div>
    </div>
  );
}
