'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { toast } from '@/components/ui/toast';
import { SettingsBanner, SettingsHeader, SettingsSection } from '../../_components/settings-ui';
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
      <SettingsHeader
        icon={ShieldAlert}
        title={t('danger.pageTitle')}
        subtitle={t('danger.pageSubtitle')}
      />
      <SettingsBanner
        show={!!message}
        tone={message?.type === 'ok' ? 'success' : 'error'}
        icon={message?.type === 'ok' ? CheckCircle2 : AlertTriangle}
        role={message?.type === 'err' ? 'alert' : 'status'}
      >
        {message?.text}
      </SettingsBanner>
      <SettingsSection
        icon={Download}
        title={t('danger.exportTitle')}
        description={t('danger.exportDesc')}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t('danger.personalData')}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('danger.personalDataDesc')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportLoading}
            className="rounded-full px-5"
          >
            <Download className="size-4" />
            {exportLoading ? t('danger.exporting') : t('danger.downloadJson')}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection
        tone="danger"
        icon={Trash2}
        title={t('danger.deleteTitle')}
        description={t('danger.deleteDesc')}
        delay={0.05}
        bodyClassName="space-y-5"
      >
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-xs font-medium text-warning">{t('danger.consequences')}</p>
          <ul className="mt-1.5 list-disc space-y-1 ps-4 text-xs leading-relaxed text-warning">
            <li>{t('danger.consequenceEnrollments')}</li>
            <li>{t('danger.consequenceUsername')}</li>
            <li>{t('danger.consequenceLogout')}</li>
          </ul>
        </div>
        <div className="space-y-2">
          <label htmlFor="danger-confirm" className="text-sm font-medium text-foreground">
            {t('danger.typeDelete')}{' '}
            <span className="rounded bg-destructive/10 px-1 font-mono text-destructive">
              DELETE
            </span>{' '}
            {t('danger.toConfirm')}
          </label>
          <Input
            id="danger-confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="danger-password" className="text-sm font-medium text-foreground">
            {t('danger.confirmPassword')}
          </label>
          <Input
            id="danger-password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder={t('danger.passwordPlaceholder')}
            autoComplete="current-password"
          />
          <p className="text-xs text-muted-foreground">{t('danger.passwordHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteLoading || deleteConfirm !== 'DELETE'}
            className="rounded-full px-6"
          >
            {deleteLoading ? t('danger.deleting') : t('danger.deletePermanently')}
          </Button>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" /> {t('danger.requiresReauth')}
          </span>
        </div>
      </SettingsSection>
    </div>
  );
}
