'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';
import { getImageSrc } from '@/lib/images';
import { Skeleton } from '@/components/ui/skeleton';

interface AcademyOption {
  slug: string;
  label: string;
  desc: string;
  color: string;
  logoUrl?: string | null;
}

/**
 * Used only when the tenant's academy API is UNREACHABLE. These entries link to
 * the academy index rather than invented slugs — the previous version linked to
 * `/academy/cnc`, `/academy/aerospace`, … which 404 for every tenant.
 */
const OFFLINE_FALLBACK: AcademyOption[] = [
  {
    slug: '',
    label: 'Browse Academies',
    desc: 'See every published academy for this site',
    color: '#0E7490',
  },
];

export function AcademiesDropdown() {
  const [open, setOpen] = useState(false);
  /** null = still loading (render nothing rather than fake rows) */
  const [academies, setAcademies] = useState<AcademyOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/proxy/academies', { credentials: 'include' });
        if (cancelled) return;
        if (!res.ok) {
          setAcademies(OFFLINE_FALLBACK);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        // Live data wins — including "no academies yet", which must NOT be
        // papered over with invented entries.
        setAcademies(
          list.map(
            (a: {
              slug: string;
              title: string;
              subtitle?: string | null;
              description?: string | null;
              accentColor?: string | null;
              logoUrl?: string | null;
            }) => ({
              slug: a.slug,
              label: a.title,
              desc: a.subtitle || a.description || a.title,
              color: a.accentColor || '#0E7490',
              logoUrl: a.logoUrl,
            }),
          ),
        );
      } catch {
        // Network failure only: fall back to an honest "browse all" entry.
        if (!cancelled) setAcademies(OFFLINE_FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = academies ?? [];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        Academies{' '}
        <m.span
          className="flex"
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          aria-hidden
        >
          <ChevronDown className="size-3.5" />
        </m.span>
      </button>

      {/* This is a hand-rolled hover popover rather than the shared
          `<DropdownMenu>`, so it doesn't inherit that primitive's
          `animate-popover-in`. Given it directly, otherwise it pops in with no
          transition at all — which is what it did before. */}
      <AnimatePresence>
        {open && (
          <m.div
            key="panel"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
            className="absolute start-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-popover p-2 shadow-lg"
          >
            {academies === null ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">No academies published yet.</p>
            ) : (
              <Stagger gap={0.03} maxDelay={0.2}>
                {items.map((a, i) => {
                  return (
                    <StaggerItem as="div" key={a.slug || a.label} index={i}>
                      <Link
                        href={a.slug ? `/academy/${a.slug}` : '/academy'}
                        className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted"
                        onClick={() => setOpen(false)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageSrc(a.logoUrl, 'academy')}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.label}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{a.desc}</p>
                        </div>
                      </Link>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
