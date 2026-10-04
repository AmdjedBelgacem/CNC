'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  Unplug,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type Status = 'connected' | 'expired' | 'revoked' | 'not_connected' | 'blocked';

interface ServiceStatus {
  service: string;
  label: string;
  customerLabel: string;
  description: string;
  accountKind: string;
  requiresDeveloperToken: boolean;
  status: Status;
  connectedEmail: string | null;
  externalAccountId: string | null;
  externalAccountIds: string[];
  scopes: string[];
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  blockedReason: string | null;
}

const TONE: Record<Status, string> = {
  connected: 'border-success/40 bg-success/10 text-success',
  expired: 'border-warning/40 bg-warning/10 text-warning',
  revoked: 'border-destructive/40 bg-destructive/10 text-destructive',
  not_connected: 'border-border bg-muted text-muted-foreground',
  blocked: 'border-border bg-muted text-muted-foreground',
};

export function IntegrationsPanel() {
  const t = useTranslations('integrations');
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [csrf, setCsrf] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () =>
      api.get<{ data: ServiceStatus[]; platform: { oauthConfigured: boolean; developerTokenPresent: boolean } }>(
        '/admin/integrations',
      ),
  });

  const services = query.data?.data ?? [];
  const platform = query.data?.platform;

  const result = searchParams.get('result');
  // Firing this during render repeats the toast on every re-render, so it runs
  // once per callback instead.
  useEffect(() => {
    if (!result) return;
    if (result === 'connected') toast({ type: 'ok', title: t('resultConnected') });
    else if (result === 'denied') toast({ type: 'err', title: t('resultDenied') });
    else toast({ type: 'err', title: `${t('resultFailed')}: ${result}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const connect = async (service: ServiceStatus) => {
    // A per-session CSRF value is echoed back through the callback URL and
    // compared with the one stored when the flow started.
    const token = csrf || `${service.service}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!csrf) setCsrf(token);
    setBusy(service.service);
    try {
      const response = await api.post<{ data: { authorizeUrl: string } }>(
        `/admin/integrations/${service.service}/connect?csrf=${encodeURIComponent(token)}`,
      );
      // The callback re-checks who started the flow and the CSRF value, so both
      // must survive the round trip through Google.
      const url = new URL(response.data.authorizeUrl);
      url.searchParams.set('initiatedBy', String(user?.id ?? ''));
      url.searchParams.set('csrf', token);
      window.location.href = url.toString();
    } catch (error) {
      setBusy(null);
      toast({ type: 'err', title: (error as Error).message });
    }
  };

  const disconnect = async (service: ServiceStatus) => {
    if (!window.confirm(t('disconnectConfirm', { service: service.label }))) return;
    setBusy(service.service);
    try {
      await api.post(`/admin/integrations/${service.service}/disconnect`);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
      toast({ type: 'ok', title: t('disconnected', { service: service.label }) });
    } catch (error) {
      toast({ type: 'err', title: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const test = async (service: ServiceStatus) => {
    setBusy(service.service);
    try {
      const response = await api.post<{ data: { ok: boolean; detail: string; accountId?: string } }>(
        `/admin/integrations/${service.service}/test`,
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
      if (response.data.ok) toast({ type: 'ok', title: `${service.label}: ${response.data.detail}` });
      else toast({ type: 'err', title: `${service.label}: ${response.data.detail}` });
    } catch (error) {
      toast({ type: 'err', title: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-3 flex items-center gap-2">
          <Search className="pointer-events-none size-4 text-muted-foreground" aria-hidden />
          <Input
            value={csrf}
            onChange={(event) => setCsrf(event.target.value)}
            placeholder="CSRF token"
            aria-label="CSRF token"
            className="h-8 max-w-xs font-mono text-xs"
          />
          <p className="text-2xs text-muted-foreground">
            {platform?.oauthConfigured
              ? 'OAuth client configured'
              : t('platformMissing')}
          </p>
        </div>
      </header>

      {query.isPending ? (
        <LoadingState rows={3} />
      ) : query.isError ? (
        <ErrorState title="Could not load integrations" onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {services.map((service) => (
            <Card key={service.service}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">{service.label}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', TONE[service.status])}>
                    {t(service.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.status === 'blocked' && service.blockedReason && (
                  <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {service.blockedReason}
                  </p>
                )}
                {service.service === 'search_console' && (
                  <p className="text-2xs italic text-muted-foreground">{t('customerNote')}</p>
                )}
                {service.connectedEmail && (
                  <p className="text-xs text-foreground">
                    {t('connectedAs')}: <span className="font-medium">{service.connectedEmail}</span>
                  </p>
                )}
                {service.externalAccountId && (
                  <p className="font-mono text-2xs text-muted-foreground">
                    {t('accountId')}: {service.externalAccountId}
                  </p>
                )}
                {service.externalAccountIds.length > 1 && (
                  <p className="text-2xs text-muted-foreground">
                    {t('accountsFound')}: {service.externalAccountIds.join(', ')}
                  </p>
                )}
                {service.lastErrorMessage && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-2xs text-destructive">
                    {service.lastErrorCode}: {service.lastErrorMessage}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {service.status === 'connected' || service.status === 'expired' || service.status === 'revoked' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void connect(service)}
                        disabled={busy === service.service}
                      >
                        {busy === service.service ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        {t('reauth')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void test(service)}
                        disabled={busy === service.service}
                      >
                        {busy === service.service ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                        {t('test')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void disconnect(service)}
                        disabled={busy === service.service}
                      >
                        <Unplug />
                        {t('disconnect')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void connect(service)}
                      disabled={busy === service.service || service.status === 'blocked'}
                    >
                      {busy === service.service ? <Loader2 className="animate-spin" /> : <Plug />}
                      {t('connect')}
                      <ExternalLink className="size-3.5" />
                    </Button>
                  )}
                </div>
                <details className="text-2xs text-muted-foreground">
                  <summary className="cursor-pointer">{t('scopes')}</summary>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {service.scopes.length === 0 ? (
                      <li>—</li>
                    ) : (
                      service.scopes.map((scope) => <li key={scope}>{scope}</li>)
                    )}
                  </ul>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
