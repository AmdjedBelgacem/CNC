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
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
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
    <div className="flex h-full min-h-0 flex-col bg-surface-sunken" aria-busy="true">
      <span className="sr-only" role="status">
        {tb('loading.subtitle', { default: tb('loading.title') })}
      </span>

      {/* tier one: identity + lifecycle */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 pt-1.5 sm:px-3.5">
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
      <div className="mx-2 flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2 shadow-xs">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="size-8 shrink-0" />
        ))}
        <Skeleton className="ms-auto size-8 shrink-0" />
      </div>

      {/* three-column body */}
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <div className="hidden w-64 shrink-0 space-y-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:block">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
        <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-background p-6 shadow-xs">
          <Skeleton className="mx-auto h-full max-w-4xl rounded-2xl border border-border/70 bg-card" />
        </div>
        <div className="hidden w-80 shrink-0 space-y-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:block">
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
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-surface-sunken p-6">
      <div className="w-full max-w-2xl">
        <Reveal className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-card text-muted-foreground shadow-xs">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-balance font-display text-2xl font-medium tracking-[-0.02em] text-foreground">
            {tb('empty.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {tb('empty.subtitle')}
          </p>
        </Reveal>

        <Stagger as="ul" className="grid gap-2.5 sm:grid-cols-2" delay={0.08}>
          {BUILDER_PAGE_DEFS.map((definition, index) => (
            <StaggerItem as="li" key={definition.slug} index={index}>
              <button
                type="button"
                onClick={() => openPage(definition.slug)}
                className="card-hover group flex h-full w-full items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-start shadow-xs transition hover:border-border-strong hover:shadow-lg active:scale-[0.99]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-sunken text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[0.9375rem] font-medium tracking-[-0.01em] text-foreground">
                    {definition.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {definition.description}
                  </span>
                </span>
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}

/** Shown when the editor chunk itself will not load. */
export function BuilderLoadFailed({ onRetry }: { onRetry: () => void }) {
  const tb = useTranslations('builder');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-sunken p-6 text-center">
      <p className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">{tb('loading.title')}</p>
      <p className="max-w-sm text-13 text-muted-foreground">{tb('loading.subtitle')}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-1 rounded-xl bg-primary px-4 py-2 text-13 font-medium text-primary-foreground shadow-xs',
          'transition hover:bg-primary/90 active:scale-[0.98]',
        )}
      >
        {tb('errorAction')}
      </button>
    </div>
  );
}
