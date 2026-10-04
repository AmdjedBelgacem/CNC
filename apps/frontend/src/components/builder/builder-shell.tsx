'use client';

/**
 * Builder shell states.
 *
 * These live here rather than in the route file because both the route (while the
 * heavy editor chunk is still loading) and the editor itself (when no page is
 * selected) need them, and a route module importing its own child is a cycle.
 */

import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BUILDER_PAGE_DEFS } from '@titan/shared';
import { useOpenPage } from './use-open-page';

/**
 * Skeleton for the editor shell.
 *
 * The editor is a heavy dynamic import (Puck plus the whole block registry), so
 * this is on screen for a noticeable moment. A centred "Loading builder…" in
 * muted grey is a dead end; a skeleton matching the two-tier bar and the
 * three-column body also covers the layout shift when the real thing arrives.
 */
export function BuilderSkeleton() {
  const tb = useTranslations('builder');
  return (
    <div className="flex h-full min-h-0 flex-col bg-background" aria-busy="true">
      <span className="sr-only" role="status">
        {tb('loading.subtitle', { default: tb('loading.title') })}
      </span>

      {/* tier one: identity + lifecycle */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3">
        <Skeleton className="size-8 shrink-0" />
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-2 w-16 rounded" />
        </div>
        <div className="ms-auto flex gap-1.5">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* tier two: the toolbox */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 sm:px-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="size-8 shrink-0" />
        ))}
        <Skeleton className="ms-auto size-8 shrink-0" />
      </div>

      {/* three-column body */}
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-64 shrink-0 space-y-2 border-e border-border bg-card p-3 lg:block">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
        <div className="min-w-0 flex-1 p-6">
          <Skeleton className="mx-auto h-full max-w-4xl rounded-xl border border-border bg-card" />
        </div>
        <div className="hidden w-80 shrink-0 space-y-2 border-s border-border bg-card p-3 lg:block">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * No page loaded.
 *
 * The previous state said "choose a page from the list above" and rendered no
 * list, so the only way out was to reload. It now offers the pages as cards.
 */
export function NoPageSelected() {
  const tb = useTranslations('builder');
  // Same owner as the header's page manager: the store write and the URL have to
  // move together, or a reload drops the author back to the homepage.
  const { openPage } = useOpenPage();

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-background p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {tb('empty.title')}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-13 leading-relaxed text-muted-foreground">
            {tb('empty.subtitle')}
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {BUILDER_PAGE_DEFS.map((definition) => (
            <li key={definition.slug}>
              <button
                type="button"
                onClick={() => openPage(definition.slug)}
                className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-start transition hover:border-primary/40 hover:shadow-sm"
              >
                <FileText
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-13 font-semibold text-foreground">
                    {definition.title}
                  </span>
                  <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
                    {definition.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Shown when the editor chunk itself will not load. */
export function BuilderLoadFailed({ onRetry }: { onRetry: () => void }) {
  const tb = useTranslations('builder');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="font-display text-lg font-semibold text-foreground">{tb('loading.title')}</p>
      <p className="max-w-sm text-13 text-muted-foreground">{tb('loading.subtitle')}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-1 rounded-md bg-primary px-3 py-1.5 text-13 font-semibold text-primary-foreground',
          'transition hover:bg-primary/90 active:scale-[0.98]',
        )}
      >
        {tb('errorAction')}
      </button>
    </div>
  );
}
