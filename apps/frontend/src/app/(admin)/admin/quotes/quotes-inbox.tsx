'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ChevronRight, Inbox, Mail, Search, X } from 'lucide-react';
import { m } from 'framer-motion';
import { ease } from '@/lib/motion';
import { PillTabs } from '@/components/admin/admin-ui';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FormSection, TextAreaField, TextField } from '@/components/admin/admin-form';
import { StatusChip } from '@/components/admin/form-page';
import { DiscardChangesDialog, DrawerFooter, useDirtyClose } from '@/components/admin/drawer-kit';
import { toast } from '@/components/ui/toast';
import { QuoteRowsSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { SkeletonRegion } from '@/components/ui/skeletons';

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
  const openQuote = items.find((q) => q.id === openId) ?? null;
  const counts = data?.counts ?? { new: 0, contacted: 0, closed: 0 };

  // The loading skeleton draws one row per request listed here, or the empty note; record how
  // many for the next visit. Only the unfiltered inbox, which is what a fresh visit opens on.
  useEffect(() => {
    if (!isLoading && data && status === 'all' && !search) rememberListCount('quotes', data.items?.length ?? 0);
  }, [isLoading, data, status, search]);

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
        <SkeletonRegion><QuoteRowsSkeleton /></SkeletonRegion>
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
            return (
              <m.li
                key={quote.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: ease.emerge, delay: Math.min(index * 0.035, 0.4) }}
                className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-200 hover:shadow-sm"

              >
                <button
                  type="button"
                  onClick={() => setOpenId(quote.id)}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40"
                  aria-haspopup="dialog"
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
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                  />
                </button>

              </m.li>
            );
          })}
        </ul>
      )}

      {openQuote ? (
        <QuoteDialog
          key={openQuote.id}
          quote={openQuote}
          pending={patch.isPending}
          onPatch={(input) => patch.mutateAsync({ id: openQuote.id, ...input })}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

const MINOR_UNITS = /^\d+$/;

function QuoteDialog({
  quote,
  pending,
  onPatch,
  onClose,
}: {
  quote: QuoteRow;
  pending: boolean;
  onPatch: (input: { status?: string; adminNote?: string | null; quotedPrice?: number | null }) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useTranslations('admin.quotes');
  const [note, setNote] = useState(quote.adminNote ?? '');
  const [price, setPrice] = useState(quote.quotedPrice != null ? String(quote.quotedPrice) : '');
  const [saved, setSaved] = useState({ note: quote.adminNote ?? '', price: quote.quotedPrice });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmed = price.trim();
  const priceValid = trimmed === '' || MINOR_UNITS.test(trimmed);
  const parsedPrice = trimmed === '' ? null : Math.round(Number(trimmed));
  const noteDirty = note !== saved.note;
  const priceDirty = priceValid && parsedPrice !== saved.price;
  const dirty = noteDirty || (trimmed !== (saved.price != null ? String(saved.price) : ''));
  const guard = useDirtyClose(dirty, onClose);

  const save = async () => {
    setAttempted(true);
    if (!priceValid) return;
    setFailed(false);
    setSaving(true);
    try {
      await onPatch({
        ...(noteDirty ? { adminNote: note || null } : {}),
        ...(priceDirty ? { quotedPrice: parsedPrice } : {}),
      });
      setSaved({ note, price: parsedPrice });
    } catch {
      // The mutation's onError already toasted.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    setNote(saved.note);
    setPrice(saved.price != null ? String(saved.price) : '');
    setAttempted(false);
  };

  const tone = quote.status === 'new' ? 'new' : quote.status === 'contacted' ? 'draft' : 'archived';

  return (
    <>
      <Modal
        onClose={guard.requestClose}
        width="max-w-xl"
        title={quote.name}
        header={
          <div className="flex items-center gap-3 border-b border-border/70 bg-card px-5 py-4 sm:gap-4 sm:px-7 sm:py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-medium text-primary ring-1 ring-inset ring-primary/15">
              {quote.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-xl font-medium leading-tight tracking-[-0.015em] text-foreground">
                  {quote.name}
                </p>
                <StatusChip tone={tone}>{t(`status.${quote.status}`)}</StatusChip>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                <span dir="ltr">{quote.email}</span>
                {quote.company ? ` · ${quote.company}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label={t('close', { default: 'Close' })}
              onClick={guard.requestClose}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-90"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        }
      >
        <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-xs text-muted-foreground">
            {t('received', { default: 'Received' })} {new Date(quote.createdAt).toLocaleString()}
          </p>
          {quote.message ? (
            <p className="max-w-prose whitespace-pre-wrap rounded-lg bg-muted/50 p-3.5 text-sm leading-relaxed">
              {quote.message}
            </p>
          ) : null}

          <FormSection as="h3" title={t('statusSection', { default: 'Status' })}>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void onPatch({ status: 'contacted' }).catch(() => undefined)}
                disabled={quote.status === 'contacted' || pending}
              >
                {quote.status === 'contacted' ? <Mail className="size-4" /> : null}
                {t('markContacted', { default: 'Mark contacted' })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void onPatch({ status: 'closed' }).catch(() => undefined)}
                disabled={quote.status === 'closed' || pending}
              >
                {t('markClosed', { default: 'Close' })}
              </Button>
            </div>
          </FormSection>

          <FormSection as="h3" title={t('details', { default: 'Details' })} badge={t('optional', { default: 'Optional' })}>
            <div className="space-y-4">
              <TextAreaField
                label={t('note', { default: 'Internal note' })}
                value={note}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
              />
              <TextField
                label={t('quotedPrice', { default: 'Quoted price (minor units)' })}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                dir="ltr"
                value={price}
                error={attempted && !priceValid ? t('priceInvalid', { default: 'Enter a whole number, 0 or more.' }) : undefined}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </FormSection>
        </div>
        <DrawerFooter
          dirty={dirty}
          saving={saving}
          failed={failed}
          onSave={save}
          onDiscard={discard}
          onClose={guard.requestClose}
        />
      </Modal>
      <DiscardChangesDialog guard={guard} />
    </>
  );
}