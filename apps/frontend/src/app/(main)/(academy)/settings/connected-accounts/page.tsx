'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Link2, Shield, Check, X, AlertCircle } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { AnimatePresence, m } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';
import { SettingsBanner, SettingsHeader, SettingsSection } from '../_components/settings-ui';
interface Account {
  provider: string;
  providerEmail?: string;
}
export default function ConnectedAccountsPage() {
  const t = useTranslations('account');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/oauth/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const handleUnlink = async (provider: string) => {
    if (!confirm(t('connectedAccounts.unlinkConfirm', { provider }))) return;
    try {
      const res = await apiProxyFetch('/api/proxy/auth/oauth/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          typeof detail?.message === 'string'
            ? detail.message
            : t('connectedAccounts.unlinkFailed'),
        );
      }
      await load();
      toast({ type: 'ok', title: t('connectedAccounts.unlinkedToast', { provider }) });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('unknownError');
      setError(message);
      toast({ type: 'err', title: t('connectedAccounts.unlinkFailed'), description: message });
    }
  };

  /**
   * OAuth needs a CSRF state that the backend has already persisted, otherwise
   * finishOauth rejects the callback with "Invalid or missing OAuth state".
   *
   * The authorize hop must be a real browser navigation straight to the API origin,
   * NOT through /api/proxy: the proxy's fetch() follows the 302 server-side and would
   * return Google's HTML as a 200 body instead of redirecting the browser.
   */
  const apiOrigin =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : '';

  const handleConnect = async (provider: string) => {
    setError('');
    try {
      const res = await apiProxyFetch('/api/proxy/auth/oauth/state');
      if (!res.ok) throw new Error('Could not start the connection. Please try again.');
      const { state } = (await res.json()) as { state?: string };
      if (!state) throw new Error('Could not start the connection. Please try again.');
      const origin = process.env.NEXT_PUBLIC_API_URL || apiOrigin;
      window.location.href = `${origin}/auth/oauth/${provider}?state=${encodeURIComponent(state)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the connection.');
    }
  };
  const providers = [
    {
      id: 'google',
      name: 'Google',
      desc: t('connectedAccounts.googleSignIn'),
      bg: 'bg-card',
      icon: 'G',
    },
    {
      id: 'github',
      name: 'GitHub',
      desc: t('connectedAccounts.githubSignIn'),
      bg: 'bg-overlay text-white',
      icon: 'GH',
    },
  ];
  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Link2}
        title={t('connectedAccounts.pageTitle')}
        subtitle={t('connectedAccounts.pageSubtitle')}
      />
      <SettingsBanner show={!!error} tone="error" icon={AlertCircle} role="alert">
        {error}
      </SettingsBanner>
      <SettingsSection
        icon={Shield}
        title={t('connectedAccounts.oauthTitle')}
        description={t('connectedAccounts.oauthDesc')}
        bodyClassName="space-y-3"
      >
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">{t('loading')}</span>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <Stagger className="space-y-3">
            {providers.map((p, index) => {
              const linked = accounts.find((a) => a.provider === p.id);
              return (
                <StaggerItem
                  key={p.id}
                  index={index}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-4 py-3.5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${p.id === 'google' ? 'border-border/70 bg-background text-foreground' : 'border-transparent bg-foreground text-background'}`}
                    >
                      {p.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {p.name}
                        <AnimatePresence initial={false} mode="wait">
                          {linked ? (
                            <m.span
                              key="linked"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                              className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-2xs font-medium text-success"
                            >
                              <Check className="size-3" /> {t('connectedAccounts.linked')}
                            </m.span>
                          ) : (
                            <m.span
                              key="unlinked"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                              className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground"
                            >
                              {t('connectedAccounts.notLinked')}
                            </m.span>
                          )}
                        </AnimatePresence>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {linked?.providerEmail || p.desc}
                      </p>
                    </div>
                  </div>
                  {linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlink(p.id)}
                      className="gap-1.5 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" /> {t('connectedAccounts.unlink')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleConnect(p.id)}
                      className="rounded-full px-4"
                    >
                      {t('connectedAccounts.connect')}
                    </Button>
                  )}
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
        <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
          {t('connectedAccounts.neverPostNote')}
        </p>
      </SettingsSection>
    </div>
  );
}
