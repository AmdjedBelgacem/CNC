'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuditRowsSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { SkeletonRegion } from '@/components/ui/skeletons';

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const PAGE_SIZE = 25;

/**
 * The tenant's audit trail, newest first.
 *
 * The endpoint filters on an exact action name, so the box suggests the actions seen on the
 * page rather than pretending to do a free-text search. One extra row is requested so
 * "Next" is only offered when there really is another page.
 */
export function AuditLog() {
  const t = useTranslations('admin.auditLog');
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'audit-logs', action, page],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE + 1), offset: String(page * PAGE_SIZE) });
      if (action) qs.set('action', action);
      return api.get<AuditRow[]>(`/admin/audit-logs?${qs.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data?.length ?? 0) > PAGE_SIZE;
  const suggestions = [...new Set(rows.map((r) => r.action))];

  const applyFilter = (value: string) => {
    setPage(0);
    setAction(value.trim());
  };

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' });

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilter(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          list="audit-actions"
          placeholder={t('filterPlaceholder')}
          aria-label={t('filterLabel')}
          className="h-9 w-72"
        />
        <datalist id="audit-actions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button type="submit" size="sm">
          {t('apply')}
        </Button>
        {action ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft('');
              applyFilter('');
            }}
          >
            {t('clear')}
          </Button>
        ) : null}
      </form>

      {isLoading ? (
        <SkeletonRegion><AuditRowsSkeleton /></SkeletonRegion>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <p className="font-medium text-foreground">{t('loadFailed')}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-10 text-center">
          <ScrollText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{action ? t('emptyFiltered') : t('empty')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-mono text-sm font-medium text-foreground">{r.action}</span>
                <time dateTime={r.createdAt} className="text-xs tabular-nums text-muted-foreground">
                  {fmt.format(new Date(r.createdAt))}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.userId ? `${t('actor')}: ${r.userId.slice(0, 8)}` : t('system')}
                {r.entityType ? ` · ${r.entityType}${r.entityId ? ` ${r.entityId.slice(0, 8)}` : ''}` : ''}
                {r.ip ? ` · ${r.ip}` : ''}
              </p>
              {r.details && Object.keys(r.details).length > 0 ? (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs text-primary">{t('details')}</summary>
                  <pre dir="ltr" className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0 || isFetching}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="flip-rtl size-4" /> {t('previous')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('page', { n: page + 1 })}</span>
        <Button size="sm" variant="outline" disabled={!hasNext || isFetching} onClick={() => setPage((p) => p + 1)}>
          {t('next')} <ChevronRight className="flip-rtl size-4" />
        </Button>
      </div>
    </div>
  );
}
