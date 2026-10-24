'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { toast } from '@/components/ui/toast';
import { AlertTriangle, Download, Trash2, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';
export default function DangerZonePage() {
  const t = useTranslations('account');
  useAuth(); // keep hook for auth check
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const handleExport = async () => {
    setExportLoading(true);
    setMessage(null);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me/data');
      if (!res.ok) throw new Error(t('danger.exportFailed'));
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `titans-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: 'ok', text: t('danger.exportDone') });
      toast({ type: 'ok', title: t('danger.exportDone') });
    } catch (err) {
      const text = err instanceof Error ? err.message : t('danger.exportFailed');
      setMessage({ type: 'err', text });
      toast({ type: 'err', title: t('danger.exportFailed'), description: text });
    } finally {
      setExportLoading(false);
    }
  };
  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') {
      setMessage({ type: 'err', text: t('danger.typeDeleteToConfirm') });
      toast({ type: 'err', title: t('danger.typeDeleteToConfirm') });
      return;
    }
    if (!confirm(t('danger.deleteConfirm'))) return;
    setDeleteLoading(true);
    try {
      // The server now enforces both the typed confirmation and the password, so
      // send them. Previously the DELETE check lived only in this component.
      const res = await apiProxyFetch('/api/proxy/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE', password: deletePassword }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          typeof detail?.message === 'string' ? detail.message : t('danger.deleteFailed'),
        );
      }
      setMessage({ type: 'ok', text: t('danger.deleteDone') });
      toast({ type: 'ok', title: t('danger.deleteDone') });
      window.location.href = '/';
    } catch (err) {
      const text = err instanceof Error ? err.message : t('danger.deleteFailed');
      setMessage({ type: 'err', text });
      toast({ type: 'err', title: t('danger.deleteFailed'), description: text });
    } finally {
      setDeleteLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          {' '}
          <ShieldAlert className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">{t('danger.pageTitle')}</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t('danger.pageSubtitle')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {message && (
        <div
          className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${message.type === 'ok' ? 'border-success bg-success/10 text-success dark:border-success/30 dark:bg-success/10 dark:text-success' : 'border-destructive bg-destructive/10 text-destructive dark:border-red-900/30 dark:bg-destructive/10 dark:text-red-300'}`}
        >
          {' '}
          {message.type === 'ok' ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          )}{' '}
          {message.text}{' '}
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <div className="flex size-8 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
            <Download className="size-4" />
          </div>{' '}
          <div>
            {' '}
            <h2 className="text-sm font-semibold">{t('danger.exportTitle')}</h2>{' '}
            <p className="text-xs text-muted-foreground">{t('danger.exportDesc')}</p>{' '}
          </div>{' '}
        </div>{' '}
        <div className="p-6">
          {' '}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            {' '}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {' '}
              <div className="flex gap-3">
                {' '}
                <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border sm:flex">
                  <Download className="size-4" />
                </div>{' '}
                <div>
                  {' '}
                  <p className="text-sm font-medium">{t('danger.personalData')}</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    {t('danger.personalDataDesc')}
                  </p>{' '}
                </div>{' '}
              </div>{' '}
              <Button
                onClick={handleExport}
                disabled={exportLoading}
                className="h-9 rounded-full px-5"
              >
                {' '}
                {exportLoading ? t('danger.exporting') : t('danger.downloadJson')}{' '}
              </Button>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-destructive bg-card shadow-sm dark:border-red-900/40">
        {' '}
        <div className="border-b border-red-100 bg-destructive/50 px-6 py-4 dark:border-red-900/20 dark:bg-destructive/[0.04]">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive dark:text-red-300">
            {' '}
            <span className="flex size-6 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
              <Trash2 className="size-3.5" />
            </span>{' '}
            {t('danger.deleteTitle')}{' '}
          </h2>{' '}
          <p className="mt-1 text-xs leading-relaxed text-destructive/80 dark:text-destructive">
            {t('danger.deleteDesc')}
          </p>{' '}
        </div>{' '}
        <div className="p-6 space-y-4">
          {' '}
          <div className="rounded-xl border border-warning/30 bg-warning px-4 py-3 /30 dark:bg-warning/10">
            {' '}
            <p className="text-xs font-semibold text-warning">
              {t('danger.consequences')}{' '}
            </p>{' '}
            <ul className="mt-1.5 list-disc space-y-1 ps-4 text-xs leading-relaxed text-warning ">
              {' '}
              <li>{t('danger.consequenceEnrollments')}</li>{' '}
              <li>{t('danger.consequenceUsername')}</li>{' '}
              <li>{t('danger.consequenceLogout')}</li>{' '}
            </ul>{' '}
          </div>{' '}
          <div className="space-y-2">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('danger.typeDelete')}{' '}
              <span className="font-mono text-destructive">DELETE</span>{' '}
              {t('danger.toConfirm')}
            </label>{' '}
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="h-10 rounded-xl bg-muted/20 font-mono"
            />{' '}
          </div>{' '}
          <div className="space-y-2">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
{t('danger.confirmPassword')}
            </label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t('danger.passwordPlaceholder')}
              autoComplete="current-password"
              className="h-10 rounded-xl bg-muted/20"
            />{' '}
            <p className="text-xs text-muted-foreground">{t('danger.passwordHint')}</p>{' '}
          </div>{' '}
          <div className="flex flex-wrap items-center gap-3">
            {' '}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading || deleteConfirm !== 'DELETE'}
              className="h-9 rounded-full px-6"
            >
              {' '}
              {deleteLoading ? t('danger.deleting') : t('danger.deletePermanently')}{' '}
            </Button>{' '}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" /> {t('danger.requiresReauth')}
            </span>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
