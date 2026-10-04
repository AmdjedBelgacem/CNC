'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { AlertTriangle, Download, Trash2, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';
export default function DangerZonePage() {
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
      if (!res.ok) throw new Error('Export failed');
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
      setMessage({ type: 'ok', text: 'Your data has been downloaded.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExportLoading(false);
    }
  };
  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') {
      setMessage({ type: 'err', text: 'Type DELETE to confirm.' });
      return;
    }
    if (!confirm('Permanently delete your account? This cannot be undone.')) return;
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
          typeof detail?.message === 'string' ? detail.message : 'Delete failed',
        );
      }
      setMessage({ type: 'ok', text: 'Your account has been deleted.' });
      window.location.href = '/';
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Delete failed' });
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
          <h1 className="text-xl font-semibold tracking-tight">Danger Zone</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Irreversible actions for your account. Proceed with care.
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
            <h2 className="text-sm font-semibold">Export your data</h2>{' '}
            <p className="text-xs text-muted-foreground">
              Download a copy of your account data.
            </p>{' '}
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
                  <p className="text-sm font-medium">Your personal data</p>{' '}
                  <p className="text-xs text-muted-foreground">
                    Profile, enrollments, orders, and preferences as JSON.
                  </p>{' '}
                </div>{' '}
              </div>{' '}
              <Button
                onClick={handleExport}
                disabled={exportLoading}
                className="h-9 rounded-full px-5"
              >
                {' '}
                {exportLoading ? 'Exporting...' : 'Download JSON'}{' '}
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
            Delete account{' '}
          </h2>{' '}
          <p className="mt-1 text-xs leading-relaxed text-destructive/80 dark:text-destructive">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>{' '}
        </div>{' '}
        <div className="p-6 space-y-4">
          {' '}
          <div className="rounded-xl border border-warning/30 bg-warning px-4 py-3 /30 dark:bg-warning/10">
            {' '}
            <p className="text-xs font-semibold text-warning">
              Consequences:
            </p>{' '}
            <ul className="mt-1.5 list-disc space-y-1 ps-4 text-xs leading-relaxed text-warning ">
              {' '}
              <li>All enrollments, progress, and certificates will be lost.</li>{' '}
              <li>Your username will be released.</li>{' '}
              <li>You will be logged out immediately.</li>{' '}
            </ul>{' '}
          </div>{' '}
          <div className="space-y-2">
            {' '}
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type <span className="font-mono text-destructive">DELETE</span> to confirm
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
              Confirm your password
            </label>{' '}
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your account password"
              autoComplete="current-password"
              className="h-10 rounded-xl bg-muted/20"
            />{' '}
            <p className="text-xs text-muted-foreground">
              Required for accounts with a password. OAuth-only accounts can leave this blank.
            </p>{' '}
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
              {deleteLoading ? 'Deleting...' : 'Permanently delete account'}{' '}
            </Button>{' '}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" /> Requires re-authentication
            </span>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
