'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AcademyCard } from '@/components/academy/academy-card';
import type { AcademySummary } from '@/lib/academies';

/**
 * Live replacement for the static `academy-grid` builder block.
 * Renders ONLY published rows from GET /academies for the current tenant.
 * Returns null when the DB has no published academies (honest empty —
 * never falls back to mock cards).
 */
export function LiveAcademyGrid({ academies }: { academies: AcademySummary[] }) {
  if (academies.length === 0) return null;
  return (
    <section className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end" style={{ marginBottom: 48 }}>
        <div className="max-w-xl">
          <h2 className="font-display mb-4 text-[44px] font-semibold leading-[1.2] text-foreground">
            Popular Academies
          </h2>
          <p className="leading-6 text-muted-foreground">
            Start with the fundamentals or push into five-axis territory — every path is
            designed to take you from blueprint to finished part.
          </p>
        </div>
        <Link
          href="/academy"
          className="group mt-6 inline-flex min-h-11 items-center rounded-full border border-violet-600/20 px-6 text-xs font-bold uppercase tracking-wider text-violet-600 transition hover:bg-violet-600/5 md:mt-0 dark:text-violet-400"
        >
          View All Paths{' '}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {academies.slice(0, 3).map((a) => (
          <AcademyCard key={a.id} academy={a} />
        ))}
      </div>
    </section>
  );
}
