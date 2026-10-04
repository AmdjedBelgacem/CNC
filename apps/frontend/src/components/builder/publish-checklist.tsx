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

import { useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import type { PageLayout } from '@titan/shared';
import { collectPublishIssues } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import { cn } from '@/lib/utils';

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

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-2xs text-success">
        <CheckCircle2 className="size-3.5" aria-hidden />
        {tb('publish.allGood')}
      </div>
    );
  }

  return (
    <details className="group">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-1.5 text-2xs',
          errors.length ? 'text-destructive' : 'text-warning',
        )}
      >
        {errors.length ? (
          <AlertTriangle className="size-3.5" aria-hidden />
        ) : (
          <CircleAlert className="size-3.5" aria-hidden />
        )}
        {errors.length
          ? tb('publish.errorCount', { count: errors.length })
          : tb('publish.warningCount', { count: warnings.length })}
      </summary>
      <ul className="mt-1.5 space-y-1 ps-1">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-start gap-1.5 text-2xs">
            <span
              className={cn(
                'mt-1 size-1.5 shrink-0 rounded-full',
                issue.level === 'error' ? 'bg-destructive' : 'bg-warning',
              )}
              aria-hidden
            />
            <span className="text-muted-foreground">
              {tb(`publish.${issue.messageKey}` as never, (issue.values ?? {}) as never)}
            </span>
          </li>
        ))}
      </ul>
    </details>
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
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable === true
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
