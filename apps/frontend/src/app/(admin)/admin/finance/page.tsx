'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  RefreshCw, Plus, DollarSign, TrendingUp, Clock, Undo2, Trash2, Pencil,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/api/normalize';
import {
  AdminCommandBar, BarIconButton, BarPrimaryButton,
  AdminKpiCard, AdminPageHeader,
} from '@/components/admin/admin-chrome';
import { Toolbar, PillTabs, TableCard, EmptyState } from '@/components/admin/admin-ui';

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
      const url = editing ? `/api/proxy/admin/budgets/${editing.id}` : '/api/proxy/admin/budgets';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
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
      const res = await fetch(`/api/proxy/admin/budgets/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard
            icon={TrendingUp}
            label={t('revenue30d', { default: 'Revenue (30d)' })}
            value={loading ? '—' : formatMoney(summary?.revenue30dCents ?? 0)}
            sub={`7d: ${formatMoney(summary?.revenue7dCents ?? 0)}`}
            tone="emerald"
          />
          <AdminKpiCard
            icon={Clock}
            label={t('pending', { default: 'Pending' })}
            value={loading ? '—' : String(summary?.pendingCount ?? 0)}
            sub={formatMoney(summary?.pendingTotalCents ?? 0)}
            tone="amber"
          />
          <AdminKpiCard
            icon={Undo2}
            label={t('refunded', { default: 'Refunded' })}
            value={loading ? '—' : formatMoney(summary?.refundedTotalCents ?? 0)}
            sub={t('allTime', { default: 'All time' })}
            tone="rose"
          />
          <AdminKpiCard
            icon={DollarSign}
            label={t('avgOrder', { default: 'Avg order' })}
            value={loading ? '—' : formatMoney(summary?.averageOrderCents ?? 0)}
            sub={t('ordersCount', { count: summary?.totalOrders ?? 0, default: '{count} orders' })}
            tone="blue"
          />
        </div>

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
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-destructive/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-destructive">
              <span className="flex size-6 items-center justify-center rounded-md bg-destructive/10">!</span>
              {error}
            </span>
            <button type="button" onClick={() => load()} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-red-700">
              {tCommon('retry', { default: 'Retry' })}
            </button>
          </div>
        )}

        {loading ? (
          <TableCard>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
                <Skeleton className="h-10 w-28 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </TableCard>
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary active:scale-[0.98]"
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
                <span className="col-span-2 text-right">
                  {t('colTarget', { default: 'Target' })}
                </span>
                <span className="col-span-2 text-right">
                  {t('colActual', { default: 'Actual' })}
                </span>
                <span className="col-span-2 text-right">
                  {t('colVariance', { default: 'Variance' })}
                </span>
                <span className="col-span-2 text-right">
                  {t('colActions', { default: 'Actions' })}
                </span>
              </div>
            }
            footer={
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span>{' '}
                {t('budgetsCount', {
                  count: filtered.length,
                  default: '{count, plural, one {budget} other {budgets}}',
                })}{' '}
                · {tCommon('page', { default: 'Page' })} 1 {tCommon('of', { default: 'of' })}{' '}
                {totalPages}
              </p>
            }
          >
            {filtered.map((b) => (
              <div key={b.id} className="grid grid-cols-12 items-center gap-2 border-b border-border px-5 py-3.5 transition last:border-0 hover:bg-muted/50">
                <span className="col-span-2">
                  <span className="inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-[0.06em]">
                    {t(`period.${PERIOD_LABEL_KEYS[b.period]}`, {
                      default: PERIOD_LABEL_DEFAULTS[b.period],
                    })}
                  </span>
                </span>
                <span className="col-span-2 text-sm font-semibold">
                  {t(`category.${CATEGORY_LABEL_KEYS[b.category]}`, {
                    default: CATEGORY_LABEL_DEFAULTS[b.category],
                  })}
                </span>
                <span className="col-span-2 text-right font-mono text-sm">{formatMoney(b.targetCents)}</span>
                <span className="col-span-2 text-right font-mono text-sm font-semibold">{formatMoney(b.actualCents)}</span>
                <span className={`col-span-2 text-right font-mono text-sm ${b.varianceCents >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {b.varianceCents >= 0 ? '+' : ''}{formatMoney(b.varianceCents)}
                </span>
                <span className="col-span-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="rounded-lg border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
                    aria-label={t('editBudgetAria', { default: 'Edit budget' })}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    className="rounded-lg border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('deleteBudgetAria', { default: 'Delete budget' })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </div>
            ))}
          </TableCard>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-semibold">
              {editing
                ? t('editBudget', { default: 'Edit budget' })
                : t('newBudget', { default: 'New budget' })}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('colPeriod', { default: 'Period' })}
                </span>
                <select
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-sm"
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {t(`period.${PERIOD_LABEL_KEYS[p]}`, { default: PERIOD_LABEL_DEFAULTS[p] })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('colCategory', { default: 'Category' })}
                </span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`category.${CATEGORY_LABEL_KEYS[c]}`, {
                        default: CATEGORY_LABEL_DEFAULTS[c],
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('targetCents', { default: 'Target (cents)' })}
                </span>
                <input
                  type="number"
                  min={0}
                  value={form.targetCents}
                  onChange={(e) => setForm((f) => ({ ...f, targetCents: Number(e.target.value) }))}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('notes', { default: 'Notes' })}
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  maxLength={500}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {tCommon('cancel', { default: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary active:scale-[0.98] disabled:opacity-50"
              >
                {saving
                  ? tCommon('saving', { default: 'Saving…' })
                  : editing
                    ? tCommon('save', { default: 'Save' })
                    : tCommon('create', { default: 'Create' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
