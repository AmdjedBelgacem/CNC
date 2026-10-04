'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, Globe, Loader2, RefreshCw, Ticket, Wallet } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CURRENCY_CODES,
  CURRENCY_NAMES,
  DEFAULT_CURRENCY,
  currencyFractionDigits,
  isCurrencyCode,
  type CurrencyCode,
} from '@titan/shared';
import { Field, FormSection, TextField, SelectInput } from '@/components/admin/admin-form';
import { StatusPill } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';
import type { AccessMode, CourseStudioData } from './types';
import * as api from './api';
import type { FxRates } from '@/lib/api/types';

const MODES: { value: AccessMode; icon: typeof Globe }[] = [
  { value: 'open', icon: Globe },
  { value: 'invite', icon: Ticket },
  { value: 'paid', icon: Wallet },
];

export function StepPricing({
  course,
  update,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('courses.studio.pricing');
  const currency: CurrencyCode = isCurrencyCode(course.currency) ? course.currency : DEFAULT_CURRENCY;
  const [rates, setRates] = useState<FxRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(false);
  const priceAmount = course.priceCents != null ? (course.priceCents / 100).toFixed(2) : '';

  // Money is formatted in the active UI locale, not a hardcoded en-US, so an
  // Arabic workspace does not show Western digit grouping.
  const formatMoney = (amount: number, code: CurrencyCode) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: currencyFractionDigits(code),
        maximumFractionDigits: currencyFractionDigits(code),
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${code}`;
    }
  };

  const loadRates = async () => {
    setRatesLoading(true);
    setRatesError(false);
    try {
      setRates(await api.getFxRates(DEFAULT_CURRENCY));
    } catch {
      setRatesError(true);
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    if (course.accessMode !== 'paid') return;
    void loadRates();
    const timer = window.setInterval(() => void loadRates(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [course.accessMode]);

  const selectedRate = rates?.rates[currency];
  const sarRate = rates?.rates.SAR ?? 1;
  const amount = (course.priceCents ?? 0) / 100;
  const amountInSar =
    currency === 'SAR' ? amount : selectedRate ? amount * (sarRate / selectedRate) : null;
  const chartData = useMemo(() => {
    const codes = (['SAR', 'USD', 'EUR', 'AED', currency] as CurrencyCode[]).filter(
      (code, index, list) => list.indexOf(code) === index,
    );
    return codes
      .map((code) => ({ currency: code, rate: rates?.rates[code] ?? (code === 'SAR' ? 1 : null) }))
      .filter((item): item is { currency: CurrencyCode; rate: number } => item.rate !== null);
  }, [currency, rates]);

  const priceMissing = course.accessMode === 'paid' && (!course.priceCents || course.priceCents <= 0);

  return (
    <div className="space-y-6">
      <FormSection
        title={t('accessMode', { default: 'Access mode' })}
        icon={Globe}
        description={t('accessModeDesc', {
          default: 'Who can enroll in this course, and whether it costs anything.',
        })}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = course.accessMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => update({ accessMode: mode.value })}
                aria-pressed={selected}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected
                    ? 'border-primary/50 bg-primary/8 shadow-xs'
                    : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg transition',
                    selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-13 font-semibold text-foreground">
                  {t(`mode.${mode.value}`, { default: mode.value })}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {t(`modeHint.${mode.value}`, { default: '' })}
                </span>
              </button>
            );
          })}
        </div>
      </FormSection>

      {course.accessMode === 'invite' && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-xs">
          {t('inviteNote', {
            default:
              'Invite-only courses do not appear in open catalogs. Enrollment is granted manually or via invite links.',
          })}
        </div>
      )}

      {course.accessMode === 'paid' && (
        <>
          <FormSection
            title={t('priceSection', { default: 'Price' })}
            icon={Wallet}
            description={t('priceSectionDesc', {
              default: 'A one-time purchase for lifetime access to this course.',
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('priceLabel', { default: 'Price' })}
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                value={priceAmount}
                onChange={(event) =>
                  update({
                    priceCents: event.target.value ? Math.round(Number(event.target.value) * 100) : 0,
                  })
                }
                placeholder="49.00"
                error={
                  priceMissing
                    ? t('priceRequired', { default: 'Set a price greater than 0 to publish.' })
                    : undefined
                }
                hint={t('priceHint', { default: 'Enter the amount learners will be charged.' })}
              />
              <Field
                label={t('currencyLabel', { default: 'Currency' })}
                hint={t('currencyHint', {
                  default: 'SAR is the primary workspace currency. Every supported ISO currency is available for local pricing.',
                })}
              >
                {(field) => (
                  <SelectInput
                    {...field}
                    value={currency}
                    onChange={(event) => {
                      if (isCurrencyCode(event.target.value)) update({ currency: event.target.value });
                    }}
                  >
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code} · {CURRENCY_NAMES[code]}
                        {code === DEFAULT_CURRENCY
                          ? ` · ${t('focusCurrency', { default: 'focus currency' })}`
                          : ''}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            </div>
          </FormSection>

          {/* Conversion panel: SAR is the workspace's focus currency, so the
              editor needs to see what the chosen price is worth in it. */}
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5" dir="ltr">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-13 font-semibold text-foreground">
                  <Activity className="size-4 text-primary" />
                  {t('liveConversion', { default: 'Live conversion' })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {amountInSar === null
                    ? t('rateUnavailable', { default: 'Live rate unavailable' })
                    : t('conversionLine', {
                        sar: formatMoney(amountInSar, DEFAULT_CURRENCY),
                        selected: formatMoney(amount, currency),
                      })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadRates()}
                disabled={ratesLoading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50"
              >
                {ratesLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {t('refresh', { default: 'Refresh' })}
              </button>
            </div>
            {ratesError && (
              <p className="mt-2 text-xs text-warning">
                {t('providerUnavailable', {
                  default:
                    'The live provider is unavailable; showing the last known or fallback rates.',
                })}
              </p>
            )}
            {rates && (
              <div className="mt-2">
                <StatusPill
                  label={
                    rates.source === 'live'
                      ? t('liveRates', { default: 'Live rates' })
                      : t('fallbackRates', { default: 'Fallback rates' })
                  }
                  tone={rates.source === 'live' ? 'emerald' : 'amber'}
                  dot={false}
                />
                <span className="ms-2 text-[11px] text-muted-foreground">
                  {t('updatedAt', {
                    at: new Date(rates.updatedAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US'),
                  })}
                </span>
              </div>
            )}
            <div className="mt-4 h-48 w-full" aria-label={t('chartLabel', { default: 'Exchange rate chart' })}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="currency" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip formatter={(value) => Number(value).toFixed(4)} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
