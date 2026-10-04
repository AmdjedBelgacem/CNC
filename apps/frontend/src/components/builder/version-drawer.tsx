'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { History, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label={tb('shortcut.close')}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tb('history.title')}
        className="relative flex h-full w-full max-w-md flex-col border-s border-border bg-card shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-13 font-semibold text-foreground">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              {tb('history.title')}
            </h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">{tb('history.subtitle')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title={tb('shortcut.close')}
            aria-label={tb('shortcut.close')}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
            <ol className="space-y-1">
              {versions.map((version) => {
                const published = version.status === 'published';
                return (
                  <li
                    key={version.id}
                    className="group flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-muted"
                  >
                    <span className="mt-0.5 shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-2xs tabular-nums text-muted-foreground">
                      v{version.version}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-2xs font-semibold uppercase tracking-wide',
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
                        'flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1',
                        'text-2xs font-semibold text-foreground transition hover:bg-muted',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      {tb('history.revert')}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
