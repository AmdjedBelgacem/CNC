'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { History, RotateCcw, X } from 'lucide-react';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { dialogMotion } from '@/components/ui/dialog';

export interface VersionRow {
  id: string;
  version: number;
  status: 'snapshot' | 'published';
  note: string | null;
  changedByName: string | null;
  createdAt: string;
}

/**
 * Version history as a proper drawer.
 *
 * The previous version was an absolutely-positioned panel floating over the canvas
 * at `top-16 end-4`: no backdrop, no Escape, no focus handling, and it covered
 * whatever was being designed behind it. It read as a dropdown, not a place with
 * its own content — and "restore this version" is not a decision to make from a
 * floating strip.
 *
 * A modal drawer is the honest container: it dims the canvas, takes Escape, and
 * asks before it discards the current draft.
 */
export function VersionDrawer({
  versions,
  saving,
  onClose,
  onRevert,
}: {
  versions: VersionRow[];
  saving: boolean;
  onClose: () => void;
  onRevert: (version: number) => void;
}) {
  const tb = useTranslations('builder');
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The drawer lives at the inline end, so it slides in from that edge in either direction.
  const offscreen =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? '-104%' : '104%';

  // Escape to dismiss, and move focus in so keyboard users are not stranded
  // behind the canvas once it opens.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end p-0 sm:p-2">
      <m.button
        type="button"
        aria-label={tb('shortcut.close')}
        onClick={onClose}
        {...dialogMotion.overlay}
        className="absolute inset-0 bg-overlay/45 backdrop-blur-[3px]"
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tb('history.title')}
        initial={{ x: offscreen, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1, transition: spring.gentle }}
        exit={{ x: offscreen, opacity: 0.6, transition: { duration: 0.22, ease: ease.exit } }}
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-border/70 bg-card shadow-xl sm:rounded-2xl sm:border"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              {tb('history.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{tb('history.subtitle')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title={tb('shortcut.close')}
            aria-label={tb('shortcut.close')}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
          {versions.length === 0 ? (
            <p className="px-3 py-8 text-center text-2xs text-muted-foreground">
              {tb('history.empty')}
            </p>
          ) : (
            <ol className="space-y-0.5">
              {versions.map((version, index) => {
                const published = version.status === 'published';
                return (
                  <m.li
                    key={version.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      transition: { ...spring.smooth, delay: 0.08 + Math.min(index, 10) * 0.03 },
                    }}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <span className="mt-0.5 shrink-0 rounded-md border border-border/70 bg-surface-sunken px-1.5 py-0.5 font-mono text-2xs tabular-nums text-muted-foreground">
                      v{version.version}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium',
                            published ? 'text-success' : 'text-muted-foreground',
                          )}
                        >
                          {published ? tb('history.published') : tb('history.snapshot')}
                        </span>
                        {version.changedByName && (
                          <span className="truncate text-2xs text-muted-foreground/80">
                            {tb('history.by', { name: version.changedByName })}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                        {version.note || tb('history.unknown')}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        // Reverting replaces the whole draft, so it is confirmed
                        // rather than fired from a hover-revealed control.
                        if (
                          window.confirm(
                            tb('history.revertConfirm', { version: version.version }),
                          )
                        ) {
                          onRevert(version.version);
                        }
                      }}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-card px-2 py-1 shadow-xs',
                        'text-2xs font-medium text-foreground transition hover:border-border-strong hover:bg-muted active:scale-95',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      {tb('history.revert')}
                    </button>
                  </m.li>
                );
              })}
            </ol>
          )}
        </div>
      </m.div>
    </div>
  );
}
