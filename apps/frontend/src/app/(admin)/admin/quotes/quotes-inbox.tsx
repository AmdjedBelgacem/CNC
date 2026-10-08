'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Inbox, Loader2, Mail, Search } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

interface QuoteRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'closed';
  quotedPrice: number | null;
  adminNote: string | null;
  productId: string | null;
  createdAt: string;
}

const STATUSES = ['all', 'new', 'contacted', 'closed'] as const;

const badgeClass: Record<string, string> = {
  new: 'border-primary/30 bg-primary/10 text-primary',
  contacted: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  closed: 'border-border bg-muted text-muted-foreground',
};

/**
 * Quote request inbox.
 *
 * Exists because the alternative is a request arriving by email and being answered from
 * memory. The status is the point: without `new → contacted → closed` there is no way to
 * know a request was handled, and no way to avoid replying twice.
 */
export function QuotesInbox() {
  const t = useTranslations('admin.quotes');
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'quotes', status, search],
    queryFn: () =>
      api.get<{ items: QuoteRow[]; counts: Record<string, number> }>(
        `/admin/quotes?status=${status}&search=${encodeURIComponent(search)}`,
      ),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; status?: string; adminNote?: string | null; quotedPrice?: number | null }) =>
      api.patch(`/admin/quotes/${input.id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'quotes'] });
      toast({ type: 'ok', title: t('updated', { default: 'Request updated' }) });
    },
    onError: (error: Error) =>
      toast({ type: 'err', title: t('updateFailed', { default: 'Could not update' }), description: error.message }),
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? { new: 0, contacted: 0, closed: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {value === 'all' ? t('filterAll', { default: 'All' }) : t(`status.${value}`)}
            {value !== 'all' && counts[value] ? (
              <span className="ms-1 opacity-70">({counts[value]})</span>
            ) : null}
          </Button>
        ))}

        <div className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search', { default: 'Search name, email or company' })}
            className="ps-9"
            aria-label={t('search', { default: 'Search' })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
          <Inbox className="size-4" />
          {t('empty', { default: 'No quote requests yet.' })}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((quote) => {
            const expanded = openId === quote.id;
            return (
              <li key={quote.id} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : quote.id)}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-start"
                  aria-expanded={expanded}
                >
                  <Badge className={cn('shrink-0', badgeClass[quote.status])}>
                    {t(`status.${quote.status}`)}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {quote.name}
                      {quote.company ? <span className="font-normal text-muted-foreground"> · {quote.company}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{quote.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </span>
                </button>

                {expanded ? (
                  <div className="space-y-4 border-t border-border p-4">
                    {quote.message ? (
                      <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
                        {quote.message}
                      </p>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`note-${quote.id}`}>{t('note', { default: 'Internal note' })}</Label>
                        <textarea
                          id={`note-${quote.id}`}
                          defaultValue={quote.adminNote ?? ''}
                          rows={3}
                          onBlur={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            if (e.target.value === (quote.adminNote ?? '')) return;
                            patch.mutate({ id: quote.id, adminNote: e.target.value || null });
                          }}
                          className="flex w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`price-${quote.id}`}>
                          {t('quotedPrice', { default: 'Quoted price (minor units)' })}
                        </Label>
                        <Input
                          id={`price-${quote.id}`}
                          type="number"
                          min={0}
                          defaultValue={quote.quotedPrice != null ? String(quote.quotedPrice) : ''}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            const parsed = next === '' ? null : Math.round(Number(next));
                            if (parsed === quote.quotedPrice) return;
                            patch.mutate({ id: quote.id, quotedPrice: parsed });
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => patch.mutate({ id: quote.id, status: 'contacted' })}
                        disabled={quote.status === 'contacted' || patch.isPending}
                      >
                        {quote.status === 'contacted' ? <Mail className="size-4" /> : null}
                        {t('markContacted', { default: 'Mark contacted' })}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => patch.mutate({ id: quote.id, status: 'closed' })}
                        disabled={quote.status === 'closed' || patch.isPending}
                      >
                        {t('markClosed', { default: 'Close' })}
                      </Button>
                      {patch.isPending ? <Loader2 className="size-4 animate-spin self-center" /> : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}