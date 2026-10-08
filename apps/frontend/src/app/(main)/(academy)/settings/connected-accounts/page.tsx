'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link2, Shield, Check, X, AlertCircle } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.unknownError'));
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
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <Link2 className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">
            {t('connectedAccounts.pageTitle')}
          </h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t('connectedAccounts.pageSubtitle')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {error && (
        <div className="flex gap-3 rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-red-900/30 dark:bg-destructive/10 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Shield className="size-3.5" />
            </span>{' '}
            {t('connectedAccounts.oauthTitle')}
          </h2>{' '}
          <p className="mt-1 text-xs text-muted-foreground">
            {t('connectedAccounts.oauthDesc')}
          </p>{' '}
        </div>{' '}
        <div className="p-6 space-y-3">
          {' '}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('account.loading')}</p>
          ) : (
            providers.map((p) => {
              const linked = accounts.find((a) => a.provider === p.id);
              return (
                <div
                  key={p.id}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-primary/20 hover:shadow-sm"
                >
                  {' '}
                  <div className="flex items-center gap-3">
                    {' '}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold shadow-sm ${p.id === 'google' ? 'bg-card border-border text-secondary' : 'bg-overlay border-border text-white'}`}
                    >
                      {' '}
                      {p.icon}{' '}
                    </div>{' '}
                    <div>
                      {' '}
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {' '}
                        {p.name}{' '}
                        {linked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-success">
                            <Check className="size-3.5" /> {t('connectedAccounts.linked')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                            {t('connectedAccounts.notLinked')}
                          </span>
                        )}{' '}
                      </p>{' '}
                      <p className="text-xs text-muted-foreground">
                        {linked?.providerEmail || p.desc}
                      </p>{' '}
                    </div>{' '}
                  </div>{' '}
                  {linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlink(p.id)}
                      className="h-8 rounded-full gap-1.5 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-red-900/30"
                    >
                      {' '}
                      <X className="size-3.5" /> {t('connectedAccounts.unlink')}{' '}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void handleConnect(p.id)}
                      className="h-8 rounded-full px-4"
                    >
                      {' '}
                      {t('connectedAccounts.connect')}{' '}
                    </Button>
                  )}{' '}
                </div>
              );
            })
          )}{' '}
        </div>{' '}
        <div className="border-t border-border/60 bg-muted/20 px-6 py-3">
          {' '}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('connectedAccounts.neverPostNote')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
