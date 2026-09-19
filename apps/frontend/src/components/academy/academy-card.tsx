import Link from 'next/link';
import { BookOpen, GraduationCap } from 'lucide-react';
import type { AcademySummary } from '@/lib/academies';
import { cn } from '@/lib/utils';

export function AcademyCard({ academy }: { academy: AcademySummary }) {
  const accent = academy.accentColor || '#7c3aed';
  const image = academy.heroImageUrl || academy.logoUrl || academy.seoImageUrl;
  const href = `/academy/${academy.slug}`;

  return (
    <Link href={href} className="group block">
      <article className="overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group-hover:border-primary/40">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {image ? (
            // Plain <img>: uploaded branding art is served from MinIO/S3 on the
            // configured public endpoint and must render without coupling to
            // next.config remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={academy.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              style={{ backgroundColor: `${accent}12` }}
            >
              <GraduationCap className="h-12 w-12 opacity-30" style={{ color: accent }} />
            </div>
          )}
          {academy.logoUrl && image !== academy.logoUrl ? (
            <div className="absolute left-4 top-4 h-11 w-11 overflow-hidden rounded-xl border border-white/60 bg-white shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={academy.logoUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            <BookOpen className="h-3.5 w-3.5" />
            {academy.courseCount} {academy.courseCount === 1 ? 'course' : 'courses'}
          </div>
        </div>
        <div className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              Academy
            </span>
            {academy.subtitle ? (
              <span className="text-[11px] font-medium text-muted-foreground line-clamp-1">
                {academy.subtitle}
              </span>
            ) : null}
          </div>
          <h3 className="mb-2 text-xl font-semibold leading-tight text-foreground">
            {academy.title}
          </h3>
          {academy.description ? (
            <p className="mb-5 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {academy.description}
            </p>
          ) : null}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span
              className={cn('inline-block h-2 w-16 rounded-full')}
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
              View academy
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
