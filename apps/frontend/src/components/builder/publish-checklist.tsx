'use client';

/**
 * Publish checklist and keyboard shortcuts.
 *
 * The builder will happily publish a page with no title, no content, or a slug
 * that can never resolve. None of those are errors — they are pages that look
 * fine in the editor and are broken on the site, and they only become obvious
 * after someone reports the dead link.
 *
 * The rules themselves live in `@titan/shared` so one implementation can gate a
 * publish button, annotate the page list, or run in CI. This file only resolves
 * the message keys those rules return against the catalog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, CheckCircle2, CircleAlert } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import type { PageLayout } from '@titan/shared';
import { collectPublishIssues } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { AnchorPanel } from '@/components/builder/anchor-panel';
import { cn } from '@/lib/utils';
import { spring, transition } from '@/lib/motion';

type PublishIssue = ReturnType<typeof collectPublishIssues>[number];

export interface PublishRecord {
  title?: string | null;
  slug?: string | null;
  status?: string | null;
  isSystem?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export function PublishChecklist({ page }: { page: PublishRecord | null }) {
  const tb = useTranslations('builder');
  // Select `data` alone, never the whole `appState`. `appState` is a fresh object
  // on nearly every Puck interaction (hover, selection, drag), so subscribing to
  // it re-renders this component — and it lives in the header, which is rendered
  // inside Puck's own tree — on every pointer move over the canvas.
  const layout = useBuilderPuck((s) => s.appState.data) as unknown as PageLayout;

  const issues = useMemo(() => collectPublishIssues(page, layout), [layout, page]);

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  /*
   * Rendered through the same portal as the Add Block menu.
   *
   * This was a native `<details>`, so the list expanded in place inside the header toolbar and was
   * painted underneath the right-hand inspector — the same clipping ancestor that trapped the
   * block menu, and the errors were unreadable in exactly the situation they matter.
   *
   * The hooks sit above the "all good" branch so the hook order is stable when the last issue is
   * fixed (an early return before them changed the hook count between renders).
   */
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  /*
   * Issues fixed while the list is open stay on it, ticked, until it closes — so the author sees
   * the check land instead of a row silently vanishing from under the pointer.
   */
  const [resolved, setResolved] = useState<PublishIssue[]>([]);
  const previous = useRef<PublishIssue[]>(issues);
  useEffect(() => {
    const before = previous.current;
    previous.current = issues;
    if (!open) return;
    const now = new Set(issues.map((i) => i.id));
    const gone = before.filter((i) => !now.has(i.id));
    setResolved((current) => {
      const kept = current.filter((i) => !now.has(i.id) && !gone.some((g) => g.id === i.id));
      const next = [...kept, ...gone];
      return next.length === current.length && next.every((i, n) => i.id === current[n]?.id)
        ? current
        : next;
    });
  }, [issues, open]);
  useEffect(() => {
    if (!open) setResolved([]);
  }, [open]);

  const allGood = issues.length === 0;
  const summary = errors.length
    ? tb('publish.errorCount', { count: errors.length })
    : tb('publish.warningCount', { count: warnings.length });

  const rows = [
    ...issues.map((issue) => ({ issue, done: false })),
    ...resolved.map((issue) => ({ issue, done: true })),
  ];

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {allGood ? (
          <m.div
            key="all-good"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, transition: spring.smooth }}
            exit={{ opacity: 0, scale: 0.96, transition: transition.leave }}
            className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-2xs font-medium text-success"
          >
            <m.span
              className="inline-flex"
              initial={{ scale: 0.4, rotate: -40 }}
              animate={{ scale: 1, rotate: 0, transition: { ...spring.snappy, delay: 0.06 } }}
            >
              <CheckCircle2 className="size-3.5" aria-hidden />
            </m.span>
            {tb('publish.allGood')}
          </m.div>
        ) : (
          <m.button
            key="issues"
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, transition: spring.smooth }}
            exit={{ opacity: 0, scale: 0.96, transition: transition.leave }}
            whileTap={{ scale: 0.96 }}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors',
              errors.length
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                : 'bg-warning/10 text-warning hover:bg-warning/15',
            )}
          >
            {errors.length ? (
              <AlertTriangle className="size-3.5" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5" aria-hidden />
            )}
            <m.span
              key={summary}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0, transition: transition.enter }}
            >
              {summary}
            </m.span>
          </m.button>
        )}
      </AnimatePresence>
      <AnchorPanel anchorRef={triggerRef} open={open && !allGood} onDismiss={close} minWidth={340}>
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto p-2" aria-label={summary}>
          <AnimatePresence initial={false}>
            {rows.map(({ issue, done }, index) => (
              <m.li
                key={issue.id}
                layout="position"
                initial={{ opacity: 0, x: -6 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  transition: { ...spring.smooth, delay: Math.min(index, 10) * 0.03 },
                }}
                exit={{ opacity: 0, transition: transition.leave }}
                transition={spring.layout}
                className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-2xs"
              >
                <span className="relative mt-px flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <m.span
                        key="done"
                        className="flex size-4 items-center justify-center rounded-full bg-success text-success-foreground"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                        exit={{ scale: 0.6, opacity: 0, transition: transition.leave }}
                      >
                        <Check className="size-2.5" strokeWidth={3} />
                      </m.span>
                    ) : (
                      <m.span
                        key="open"
                        className={cn(
                          'size-4 rounded-full border-[1.5px]',
                          issue.level === 'error' ? 'border-destructive/70' : 'border-warning/70',
                        )}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                        exit={{ scale: 0.6, opacity: 0, transition: transition.leave }}
                      />
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={cn(
                    'leading-relaxed transition-colors duration-300',
                    done ? 'text-muted-foreground/60 line-through decoration-success/50' : 'text-foreground/80',
                  )}
                >
                  {tb(`publish.${issue.messageKey}` as never, (issue.values ?? {}) as never)}
                </span>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      </AnchorPanel>
    </>
  );
}

/**
 * Delete-selection.
 *
 * Deliberately does NOT bind Cmd/Ctrl+S: `builder-editor` already binds it
 * against its own `saveDraft`, and a second binding would fire two saves per
 * keystroke. Undo/redo is absent for the same reason Puck owns it.
 */
export function useBuilderShortcuts(options: { onDeleteSelected?: () => void } = {}) {
  const { onDeleteSelected } = options;

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
      );
    };

    const onKey = (event: KeyboardEvent) => {
      // Suppressed inside text fields, so Backspace still deletes a character
      // rather than the block the cursor happens to be in.
      if (isTyping(event.target)) return;
      if ((event.key === 'Backspace' || event.key === 'Delete') && onDeleteSelected) {
        event.preventDefault();
        onDeleteSelected();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDeleteSelected]);
}

/**
 * Mounts the keyboard shortcuts inside the editor.
 *
 * A separate component rather than a bare hook call so the editor has one
 * obvious place where shortcuts are registered — the first version shipped the
 * hook and the checklist as dead code because nothing mounted them.
 */
export function BuilderShortcuts() {
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const selector = useBuilderPuck((s) => s.appState.ui.itemSelector);

  const onDeleteSelected = useCallback(() => {
    if (!selector) return;
    dispatch({ type: 'remove', index: selector.index ?? 0, zone: selector.zone } as never);
  }, [dispatch, selector]);

  useBuilderShortcuts({ onDeleteSelected });
  return null;
}
