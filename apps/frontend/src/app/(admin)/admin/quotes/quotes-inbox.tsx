'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ChevronDown, Inbox, Loader2, Mail, Search } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { ease } from '@/lib/motion';
import { PillTabs } from '@/components/admin/admin-ui';
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
  new: 'border-primary/15 bg-primary/10 text-primary',
  contacted: 'border-warning/20 bg-warning/10 text-warning',
  closed: 'border-border/70 bg-muted text-muted-foreground',
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-xs">
        <div className="w-full sm:w-auto">
          <PillTabs
            value={status}
            onChange={(value) => setStatus(value)}
            options={STATUSES.map((value) => ({
              key: value,
              label: value === 'all' ? t('filterAll', { default: 'All' }) : t(`status.${value}`),
              count: value !== 'all' && counts[value] ? counts[value] : undefined,
            }))}
          />
        </div>

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
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <m.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: ease.emerge }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-surface-sunken/30 px-4 py-14 text-center text-sm text-muted-foreground"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-[18px]" />
          </span>
          {t('empty', { default: 'No quote requests yet.' })}
        </m.p>
      ) : (
        <ul className="space-y-2">
          {items.map((quote, index) => {
            const expanded = openId === quote.id;
            return (
              <m.li
                key={quote.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: ease.emerge, delay: Math.min(index * 0.035, 0.4) }}
                className={cn(
                  'overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-200',
                  expanded ? 'border-border shadow-md' : 'border-border/70 shadow-xs hover:shadow-sm',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : quote.id)}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40"
                  aria-expanded={expanded}
                >
                  <Badge className={cn('shrink-0', badgeClass[quote.status])}>
                    {t(`status.${quote.status}`)}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {quote.name}
                      {quote.company ? <span className="font-normal text-muted-foreground"> · {quote.company}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{quote.email}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-300',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                {expanded ? (
                  <m.div
                    key="details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1, transition: { duration: 0.32, ease: ease.emerge } }}
                    exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: ease.exit } }}
                    className="overflow-hidden"
                  >
                  <div className="space-y-4 border-t border-border/60 p-4">
                    {quote.message ? (
                      <p className="max-w-prose whitespace-pre-wrap rounded-lg bg-muted/50 p-3.5 text-sm leading-relaxed">
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
                          className="flex w-full resize-y rounded-lg border border-border/90 bg-card px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/15"
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
                  </m.div>
                ) : null}
                </AnimatePresence>
              </m.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}