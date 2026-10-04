'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';

interface PaymentConfig {
  provider: string;
  publishableKey: string | null;
  publishableKeyMasked: string | null;
  secretKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  currency: string;
  enabled: boolean;
  liveMode: boolean;
  status: string;
  lastErrorCode: string | null;
  encryptionReady: boolean;
  health: {
    configured: boolean;
    enabled: boolean;
    publishableKeyPresent: boolean;
    secretKeyPresent: boolean;
    webhookSecretPresent: boolean;
    currency: string;
    liveMode: boolean;
    status: string;
    lastErrorCode: string | null;
    encryptionReady: boolean;
  };
}

interface OrderRow {
  id: string;
  status: string;
  total: number;
  currency: string;
  provider: string;
  createdAt: string;
  userId: string;
}

interface OrderLine {
  id: string;
  itemType: string;
  title: string;
  quantity: number;
  fulfillmentState: string;
  fulfillmentError: string | null;
}

/** The reconciliation view: gateway id, why it failed, and delivery per line. */
interface OrderDetail extends OrderRow {
  providerPaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  fulfillmentComplete: boolean;
  items: OrderLine[];
  products: Array<{ id: string; productId: string; quantity: number; status: string }>;
}

const STATUS_TONE: Record<string, string> = {
  paid: 'border-success/40 bg-success/10 text-success',
  pending: 'border-warning/40 bg-warning/10 text-warning',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  refunded: 'border-border bg-muted text-muted-foreground',
  canceled: 'border-border bg-muted text-muted-foreground',
};

/**
 * Tenant payment gateway settings.
 *
 * The secret key and webhook secret are write-only: the read endpoint returns only
 * whether one exists, so this form can say "configured" without the value ever
 * reaching the browser.
 */
export function PaymentSettingsPanel() {
  const t = useTranslations('paymentsAdmin');
  const queryClient = useQueryClient();
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [enabled, setEnabled] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  const config = useQuery({
    queryKey: ['admin', 'payments', 'config'],
    queryFn: () => api.get<{ data: PaymentConfig }>('/admin/payments/config'),
  });

  const orders = useQuery({
    queryKey: ['admin', 'payments', 'orders'],
    queryFn: () => api.get<{ data: OrderRow[] }>('/admin/payments/orders?limit=20'),
  });

  const data = config.data?.data;

  // Seeding the form from the server is an effect, not render-phase state: doing
  // it inline is a React warning and can loop.
  useEffect(() => {
    if (data && !seeded) {
      setPublishableKey(data.publishableKey ?? '');
      setCurrency(data.currency ?? 'SAR');
      setEnabled(data.enabled);
      setLiveMode(data.liveMode);
      setSeeded(true);
    }
  }, [data, seeded]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/payments/config', {
        publishableKey: publishableKey || undefined,
        secretKey: secretKey || undefined,
        webhookSecret: webhookSecret || undefined,
        currency,
        enabled,
        liveMode,
      });
      // Local state is cleared so the stored value is never echoed back to the DOM.
      setSecretKey('');
      setWebhookSecret('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast({ type: 'ok', title: t('saved') });
    } catch (error) {
      const message = (error as Error).message ?? '';
      toast({ type: 'err', title: /secret key is required/i.test(message) ? t('needsSecret') : message });
    } finally {
      setSaving(false);
    }
  };

  const [expanded, setExpanded] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['admin', 'payments', 'order', expanded],
    queryFn: () => api.get<{ data: OrderDetail }>(`/admin/payments/orders/${expanded}`),
    enabled: Boolean(expanded),
  });

  const orderDetail = detail.data?.data;

  const toggleDetail = async (orderId: string) => {
    setExpanded((current) => (current === orderId ? null : orderId));
  };

  /** Retry delivery for a paid order whose lines failed. Safe to repeat. */
  const refulfill = async (orderId: string) => {
    try {
      await api.post(`/admin/payments/orders/${orderId}/refulfill`, {});
      toast({ type: 'ok', title: t('refillQueued') });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    } catch (error) {
      toast({ type: 'err', title: (error as Error).message });
    }
  };

  const refund = async (order: OrderRow) => {
    try {
      await api.post(`/admin/payments/orders/${order.id}/refund`, {});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast({ type: 'ok', title: t('refunded') });
    } catch (error) {
      toast({ type: 'err', title: (error as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CreditCard className="size-4" />
            {t('title')} — {t('moyasar')}
          </CardTitle>
          <CardDescription>
            {data?.health.encryptionReady === false ? (
              <span className="flex items-center gap-1.5 text-destructive">
                <ShieldAlert className="size-3.5" />
                {t('encryptionMissing')}
              </span>
            ) : data?.enabled ? (
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-3.5" />
                {t('healthOk')}
              </span>
            ) : (
              t('notConfigured')
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.isPending ? (
            <LoadingState />
          ) : config.isError ? (
            <ErrorState title="Could not load payment settings" onRetry={() => void config.refetch()} />
          ) : (
            <>
              {!data?.health.webhookSecretPresent && data?.health.enabled && (
                <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Without a webhook secret every inbound webhook is rejected, so a payment can
                  only be confirmed by the payer returning to the callback URL.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pay-pk">{t('publishableKey')}</Label>
                  <Input
                    id="pay-pk"
                    value={publishableKey}
                    onChange={(event) => setPublishableKey(event.target.value)}
                    placeholder={data?.publishableKeyMasked ?? 'pk_live_…'}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-currency">{t('currency')}</Label>
                  <Input
                    id="pay-currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
                    className="font-mono text-xs uppercase"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-sk">{t('secretKey')}</Label>
                  <Input
                    id="pay-sk"
                    type="password"
                    autoComplete="off"
                    value={secretKey}
                    onChange={(event) => setSecretKey(event.target.value)}
                    placeholder={data?.secretKeyConfigured ? t('configured') : 'sk_live_…'}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('writeOnly')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-wh">{t('webhookSecret')}</Label>
                  <Input
                    id="pay-wh"
                    type="password"
                    autoComplete="off"
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder={data?.webhookSecretConfigured ? t('configured') : '••••'}
                    className="font-mono text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">{t('writeOnly')}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                  {t('enabled')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={liveMode} onCheckedChange={setLiveMode} />
                  <span>
                    {t('liveMode')}
                    <span className="ms-2 text-2xs text-muted-foreground">{t('liveModeHint')}</span>
                  </span>
                </label>
                {data?.lastErrorCode && (
                  <Badge variant="outline" className="text-destructive">
                    {data.lastErrorCode}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => void save()} disabled={saving || data?.health.encryptionReady === false}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {saving ? t('saving') : t('save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSecretKey('');
                    setWebhookSecret('');
                  }}
                >
                  <RotateCcw />
                  {t('done')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('orders')}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.isPending ? (
            <LoadingState />
          ) : (orders.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pe-3">{t('order')}</th>
                    <th className="py-2 pe-3">{t('status')}</th>
                    <th className="py-2 pe-3">{t('amount')}</th>
                    <th className="py-2 pe-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.data!.data.map((order) => (
                    <Fragment key={order.id}>
                      <tr className="border-t border-border">
                        <td className="py-2 pe-3 font-mono text-2xs text-foreground">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => void toggleDetail(order.id)}
                          >
                            {order.id.slice(0, 8)} · {order.provider}
                          </button>
                        </td>
                        <td className="py-2 pe-3">
                          <Badge variant="outline" className={STATUS_TONE[order.status] ?? STATUS_TONE.canceled}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-2 pe-3 tabular-nums text-foreground">
                          {(order.total / 100).toFixed(2)} {order.currency}
                        </td>
                        <td className="py-2 pe-3 text-end">
                          {order.status === 'paid' && (
                            <Button size="sm" variant="ghost" onClick={() => void refund(order)}>
                              {t('refund')}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expanded === order.id && orderDetail && (
                        <tr className="border-t border-border bg-muted/30">
                          <td colSpan={4} className="py-3">
                            <dl className="grid gap-1.5 text-2xs text-muted-foreground sm:grid-cols-3">
                              <div>
                                <dt className="font-medium text-foreground">{t('providerPaymentId')}</dt>
                                <dd className="font-mono">
                                  {orderDetail.providerPaymentId ?? t('none')}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-medium text-foreground">{t('lastError')}</dt>
                                <dd className="font-mono">{orderDetail.failureReason ?? t('none')}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-foreground">{t('fulfillmentState')}</dt>
                                <dd className="font-mono">
                                  {orderDetail.fulfillmentComplete ? t('complete') : t('incomplete')}
                                </dd>
                              </div>
                            </dl>
                            <ul className="mt-2 space-y-1 text-2xs">
                              {orderDetail.items.map((line) => (
                                <li key={line.id} className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      line.fulfillmentState === 'fulfilled'
                                        ? STATUS_TONE.paid
                                        : line.fulfillmentState === 'failed'
                                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                          : STATUS_TONE.pending
                                    }
                                  >
                                    {line.fulfillmentState}
                                  </Badge>
                                  <span className="text-foreground">{line.title}</span>
                                  <span className="text-muted-foreground">
                                    {t('quantity')}: {line.quantity}
                                  </span>
                                  {line.fulfillmentError && (
                                    <span className="text-destructive">{line.fulfillmentError}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {orderDetail.products.length > 0 && (
                              <p className="mt-2 font-mono text-2xs text-muted-foreground">
                                {t('purchasesRecorded')}: {orderDetail.products.length}
                              </p>
                            )}
                            {orderDetail.status === 'paid' && !orderDetail.fulfillmentComplete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => void refulfill(order.id)}
                              >
                                {t('refulfill')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
