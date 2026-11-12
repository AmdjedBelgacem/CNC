'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  RefreshCw, Plus, DollarSign, TrendingUp, Clock, Undo2, Trash2, Pencil,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { formatMinorUnits } from '@/lib/money';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@titan/shared';
import {
  AdminCommandBar, BarIconButton, BarPrimaryButton,
  AdminKpiCard, AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { Toolbar, PillTabs, TableCard, EmptyState, ErrorBanner } from '@/components/admin/admin-ui';
import { SelectField, TextAreaField, TextField } from '@/components/admin/admin-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnimatePresence, m } from 'framer-motion';
import { ease } from '@/lib/motion';
import { Crossfade, Stagger, StaggerItem } from '@/components/ui/motion';
import { BudgetsTableSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { SkeletonRegion } from '@/components/ui/skeletons';

interface BudgetRow {
  id: string;
  period: 'month' | 'quarter' | 'year';
  category: 'revenue' | 'ops' | 'marketing' | 'product' | 'other';
  targetCents: number;
  actualCents: number;
  varianceCents: number;
  progressPct: number;
  notes: string | null;
  createdAt: string;
}

interface FinanceSummary {
  revenue30dCents: number;
  revenue7dCents: number;
  pendingCount: number;
  pendingTotalCents: number;
  refundedTotalCents: number;
  totalOrders: number;
  byStatus: Record<string, number>;
  orderCount: number;
  averageOrderCents: number;
}

const PERIODS = ['month', 'quarter', 'year'] as const;
const CATEGORIES = ['revenue', 'ops', 'marketing', 'product', 'other'] as const;

const PERIOD_LABEL_KEYS: Record<(typeof PERIODS)[number], string> = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
};

const CATEGORY_LABEL_KEYS: Record<(typeof CATEGORIES)[number], string> = {
  revenue: 'revenue',
  ops: 'ops',
  marketing: 'marketing',
  product: 'product',
  other: 'other',
};

const PERIOD_LABEL_DEFAULTS: Record<(typeof PERIODS)[number], string> = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

const CATEGORY_LABEL_DEFAULTS: Record<(typeof CATEGORIES)[number], string> = {
  revenue: 'Revenue',
  ops: 'Ops',
  marketing: 'Marketing',
  product: 'Product',
  other: 'Other',
};

export default function AdminFinancePage() {
  const tAdmin = useTranslations('admin');
  const t = useTranslations('admin.financePage');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const money = useCallback(
    (cents: number) => formatMinorUnits(cents, DEFAULT_CURRENCY as CurrencyCode, locale),
    [locale],
  );
  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>('');
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ period: 'month', category: 'revenue', targetCents: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch('/api/proxy/admin/budgets', { credentials: 'include' }),
        fetch('/api/proxy/admin/finance/summary', { credentials: 'include' }),
      ]);
      if (!bRes.ok) throw new Error(`Request failed (${bRes.status})`);
      if (!sRes.ok) throw new Error(`Request failed (${sRes.status})`);
      const bData = await bRes.json();
      const sData = await sRes.json();
      setBudgets(Array.isArray(bData) ? bData : []);
      setSummary(sData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load finance data');
      setBudgets(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ period: 'month', category: 'revenue', targetCents: 0, notes: '' });
    setShowForm(true);
  };

  const openEdit = (b: BudgetRow) => {
    setEditing(b);
    setForm({ period: b.period, category: b.category, targetCents: b.targetCents, notes: b.notes ?? '' });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        period: form.period,
        category: form.category,
        targetCents: Number(form.targetCents) || 0,
        notes: form.notes || undefined,
      };
      const url = editing ? `/admin/budgets/${editing.id}` : '/admin/budgets';
      if (editing) await api.patch(url, payload);
      else await api.post(url, payload);
      toast({
        type: 'ok',
        title: editing
          ? t('budgetUpdated', { default: 'Budget updated' })
          : t('budgetCreated', { default: 'Budget created' }),
      });
      setShowForm(false);
      load(true);
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('saveFailed', { default: 'Save failed' }),
        description: e?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/admin/budgets/${id}`);
      toast({ type: 'ok', title: t('budgetDeleted', { default: 'Budget deleted' }) });
      load(true);
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('deleteFailed', { default: 'Delete failed' }),
        description: e?.message,
      });
    }
  };

  const filtered = (budgets ?? []).filter((b) => !periodFilter || b.period === periodFilter);
  const totalPages = 1;

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('finance', { default: 'Finance' }) }]}
        count={loading ? null : filtered.length}
        live={tAdmin('live', { default: 'Live' })}
        actions={
          <BarIconButton
            title={t('refreshAria', { default: 'Refresh finance' })}
            spinning={loading || refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw className="size-4" />
          </BarIconButton>
        }
        primary={
          <BarPrimaryButton icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={openCreate}>
            {t('newBudget', { default: 'New budget' })}
          </BarPrimaryButton>
        }
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pt-6">
        <AdminPageHeader
          title={tAdmin('finance', { default: 'Finance' })}
          description={t('description', {
            default:
              'Track revenue, pending payments, refunds, and category budgets against actuals.',
          })}
        />

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem index={0}>
          <AdminKpiCard
            icon={TrendingUp}
            label={t('revenue30d', { default: 'Revenue (30d)' })}
            value={loading ? '—' : money(summary?.revenue30dCents ?? 0)}
            sub={`7d: ${money(summary?.revenue7dCents ?? 0)}`}
            tone="emerald"
          />
          </StaggerItem>
          <StaggerItem index={1}>
          <AdminKpiCard
            icon={Clock}
            label={t('pending', { default: 'Pending' })}
            value={loading ? '—' : (summary?.pendingCount ?? 0)}
            sub={money(summary?.pendingTotalCents ?? 0)}
            tone="amber"
          />
          </StaggerItem>
          <StaggerItem index={2}>
          <AdminKpiCard
            icon={Undo2}
            label={t('refunded', { default: 'Refunded' })}
            value={loading ? '—' : money(summary?.refundedTotalCents ?? 0)}
            sub={t('allTime', { default: 'All time' })}
            tone="rose"
          />
          </StaggerItem>
          <StaggerItem index={3}>
          <AdminKpiCard
            icon={DollarSign}
            label={t('avgOrder', { default: 'Avg order' })}
            value={loading ? '—' : money(summary?.averageOrderCents ?? 0)}
            sub={t('ordersCount', { count: summary?.totalOrders ?? 0, default: '{count} orders' })}
            tone="blue"
          />
          </StaggerItem>
        </Stagger>

        <Toolbar>
          <PillTabs
            value={periodFilter}
            onChange={(k) => setPeriodFilter(k)}
            options={[
              { key: '', label: t('allPeriods', { default: 'All periods' }) },
              { key: 'month', label: t('period.month', { default: 'Monthly' }) },
              { key: 'quarter', label: t('period.quarter', { default: 'Quarterly' }) },
              { key: 'year', label: t('period.year', { default: 'Yearly' }) },
            ]}
          />
        </Toolbar>

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => load()}
            retryLabel={tCommon('retry', { default: 'Retry' })}
          />
        )}

        {loading ? (
          <SkeletonRegion><BudgetsTableSkeleton /></SkeletonRegion>
        ) : filtered.length === 0 ? (
          <TableCard>
            <EmptyState
              icon={DollarSign}
              title={
                periodFilter
                  ? t('emptyNoMatch', { default: 'No budgets match your filter' })
                  : t('emptyCreateFirst', { default: 'Create your first budget' })
              }
              body={
                periodFilter
                  ? t('emptyNoMatchBody', { default: 'Try a different period filter.' })
                  : t('emptyCreateFirstBody', {
                      default:
                        'Set revenue or expense targets by category and period to track performance against actuals.',
                    })
              }
              action={
                <button
                  type="button"
                  onClick={periodFilter ? () => setPeriodFilter('') : openCreate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                >
                  {periodFilter ? (
                    t('clearFilter', { default: 'Clear filter' })
                  ) : (
                    <>
                      <Plus className="size-4" /> {t('newBudget', { default: 'New budget' })}
                    </>
                  )}
                </button>
              }
            />
          </TableCard>
        ) : (
          <TableCard
            header={
              <div className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-2">{t('colPeriod', { default: 'Period' })}</span>
                <span className="col-span-2">{t('colCategory', { default: 'Category' })}</span>
                <span className="col-span-2 text-end">
                  {t('colTarget', { default: 'Target' })}
                </span>
                <span className="col-span-2 text-end">
                  {t('colActual', { default: 'Actual' })}
                </span>
                <span className="col-span-2 text-end">
                  {t('colVariance', { default: 'Variance' })}
                </span>
                <span className="col-span-2 text-end">
                  {t('colActions', { default: 'Actions' })}
                </span>
              </div>
            }
            footer={
              <p className="text-xs text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">{filtered.length}</span>{' '}
                {t('budgetsCount', {
                  count: filtered.length,
                  default: '{count, plural, one {budget} other {budgets}}',
                })}{' '}
                · {tCommon('page', { default: 'Page' })} 1 {tCommon('of', { default: 'of' })}{' '}
                {totalPages}
              </p>
            }
          >
            <Crossfade value={periodFilter || 'all'} axis="none">
            <AnimatePresence initial={false}>
            {filtered.map((b, index) => (
              <m.div
                key={b.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: ease.emerge, delay: Math.min(index * 0.03, 0.36) } }}
                exit={{ opacity: 0, x: -8, transition: { duration: 0.16, ease: ease.exit } }}
                className="group grid grid-cols-12 items-center gap-2 border-b border-border/60 px-5 py-3 transition-colors last:border-0 hover:bg-muted/40"
              >
                <span className="col-span-2">
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(`period.${PERIOD_LABEL_KEYS[b.period]}`, {
                      default: PERIOD_LABEL_DEFAULTS[b.period],
                    })}
                  </span>
                </span>
                <span className="col-span-2 text-sm font-medium">
                  {t(`category.${CATEGORY_LABEL_KEYS[b.category]}`, {
                    default: CATEGORY_LABEL_DEFAULTS[b.category],
                  })}
                </span>
                <span className="col-span-2 text-end text-sm tabular-nums text-muted-foreground">{money(b.targetCents)}</span>
                <span className="col-span-2 text-end text-sm font-medium tabular-nums">{money(b.actualCents)}</span>
                <span className={`col-span-2 text-end text-sm font-medium tabular-nums ${b.varianceCents >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {b.varianceCents >= 0 ? '+' : ''}{money(b.varianceCents)}
                </span>
                <span className="col-span-2 flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    aria-label={t('editBudgetAria', { default: 'Edit budget' })}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    aria-label={t('deleteBudgetAria', { default: 'Delete budget' })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </m.div>
            ))}
            </AnimatePresence>
            </Crossfade>
          </TableCard>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('editBudget', { default: 'Edit budget' })
                : t('newBudget', { default: 'New budget' })}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <SelectField
              label={t('colPeriod', { default: 'Period' })}
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`period.${PERIOD_LABEL_KEYS[p]}`, { default: PERIOD_LABEL_DEFAULTS[p] })}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t('colCategory', { default: 'Category' })}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${CATEGORY_LABEL_KEYS[c]}`, {
                    default: CATEGORY_LABEL_DEFAULTS[c],
                  })}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t('targetCents', { default: 'Target (cents)' })}
              type="number"
              min={0}
              dir="ltr"
              value={form.targetCents}
              onChange={(e) => setForm((f) => ({ ...f, targetCents: Number(e.target.value) }))}
              className="tabular-nums"
            />
            <TextAreaField
              label={t('notes', { default: 'Notes' })}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              maxLength={500}
              rows={2}
              className="min-h-0"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              {tCommon('cancel', { default: 'Cancel' })}
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving
                ? tCommon('saving', { default: 'Saving…' })
                : editing
                  ? tCommon('save', { default: 'Save' })
                  : tCommon('create', { default: 'Create' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
