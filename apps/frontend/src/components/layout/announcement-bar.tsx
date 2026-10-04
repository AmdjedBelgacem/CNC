'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';

// Static promo slots (brand copy only — no metrics, no guessed academy slugs).
const PROMOS = [
  { text: 'New academies are live — browse courses and start learning', link: '/academy' },
  { text: 'Explore industry-grade CNC tools and workholding', link: '/products?category=Workholding' },
  { text: 'Join the manufacturing community', link: '/feed' },
];

export function AnnouncementBar() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % PROMOS.length), 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <m.div
          key="bar"
          // Dismissing collapses the bar's own height rather than unmounting it
          // instantly, so the nav below slides up instead of jumping.
          initial={false}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: transition.leave }}
          className="relative overflow-hidden border-b border-primary-foreground/10 bg-primary text-primary-foreground"
        >
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-12">
            {/* Keyed on `idx` so each promo crossfades and rises in turn. The
                old copy has to finish leaving before the new one arrives, which
                is what `mode="wait"` buys — otherwise two different messages
                overlap mid-swap and both are briefly unreadable. */}
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: transition.enter }}
                exit={{ opacity: 0, y: -8, transition: transition.leave }}
                className="min-w-0"
              >
                <Link
                  href={PROMOS[idx]!.link}
                  className="flex items-center gap-1.5 truncate text-xs font-medium opacity-90 transition-opacity hover:opacity-100"
                >
                  {PROMOS[idx]!.text}
                  <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
                </Link>
              </m.div>
            </AnimatePresence>

            <div className="absolute end-4 flex items-center gap-2">
              <div className="hidden gap-1.5 sm:flex">
                {PROMOS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Show announcement ${i + 1}`}
                    className={cn(
                      'h-1.5 rounded-full bg-current',
                      i === idx ? 'w-4 opacity-100' : 'w-1.5 opacity-50',
                    )}
                  >
                    {/* The active dot's width animates as a spring rather than a
                        `transition-all`, so the dots feel like one control that
                        deforms instead of three independent bars changing size. */}
                    <m.span
                      className="block h-full rounded-full bg-current"
                      animate={{ width: i === idx ? 16 : 6, opacity: i === idx ? 1 : 0.5 }}
                      transition={spring.snappy}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss announcement"
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
