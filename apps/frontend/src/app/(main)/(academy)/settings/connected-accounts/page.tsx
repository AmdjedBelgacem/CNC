'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Shield, Check, X, AlertCircle } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
interface Account {
  provider: string;
  providerEmail?: string;
}
export default function ConnectedAccountsPage() {
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
    if (!confirm(`Unlink ${provider}?`)) return;
    try {
      const res = await apiProxyFetch('/api/proxy/auth/oauth/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };
  const providers = [
    { id: 'google', name: 'Google', desc: 'Sign in with Google', bg: 'bg-white', icon: 'G' },
    {
      id: 'github',
      name: 'GitHub',
      desc: 'Sign in with GitHub',
      bg: 'bg-zinc-900 text-white',
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
          <Link2 className="h-5 w-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Connected Accounts</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Link your social accounts for faster sign-in.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {error && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Shield className="h-3.5 w-3.5" />
            </span>{' '}
            OAuth Connections
          </h2>{' '}
          <p className="mt-1 text-xs text-muted-foreground">
            Manage linked providers. Keep at least one sign-in method.
          </p>{' '}
        </div>{' '}
        <div className="p-6 space-y-3">
          {' '}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
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
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold shadow-sm ${p.id === 'google' ? 'bg-white border-border text-zinc-700' : 'bg-zinc-900 border-zinc-800 text-white'}`}
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            <Check className="h-3 w-3" /> Linked
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Not linked
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
                      className="h-8 rounded-full gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30"
                    >
                      {' '}
                      <X className="h-3.5 w-3.5" /> Unlink{' '}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => (window.location.href = `/api/auth/oauth/${p.id}?redirect=1`)}
                      className="h-8 rounded-full px-4"
                    >
                      {' '}
                      Connect{' '}
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
            We never post without permission. Unlinking requires a password set on your account.
          </p>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
