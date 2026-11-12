'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { readApiError } from '@/lib/api-error';

interface Settings {
  mainModel: string | null;
  mainBaseUrl: string | null;
  visionModel: string | null;
  visionBaseUrl: string | null;
  hasVisionKey: boolean;
}

/**
 * Which model reads pictures.
 *
 * The page is always built by the main AI provider (DeepSeek). Pictures need a model that can
 * see, so a screenshot is first described by the vision model set here, once, and the cheap text
 * model does the rest. Blank fields fall back to the main provider's address and key.
 */
export function AiSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('builder.ai.settingsDialog');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const response = await apiProxyFetch('/api/proxy/builder/ai/settings');
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as Settings;
      setSettings(body);
      setModel(body.visionModel ?? '');
      setBaseUrl(body.visionBaseUrl ?? '');
      setApiKey('');
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await apiProxyFetch('/api/proxy/builder/ai/settings', {
        method: 'PUT',
        body: JSON.stringify({
          visionModel: model.trim() || null,
          visionBaseUrl: baseUrl.trim() || null,
          ...(apiKey.trim() ? { visionApiKey: apiKey.trim() } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, t('saveFailed')));
      setSettings((await response.json()) as Settings);
      toast({ type: 'ok', title: t('saved') });
      onClose();
    } catch (error) {
      toast({ type: 'err', title: t('saveFailed'), description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    const response = await apiProxyFetch('/api/proxy/builder/ai/settings', {
      method: 'PUT',
      body: JSON.stringify({ visionApiKey: null }),
    });
    if (response.ok) setSettings((await response.json()) as Settings);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-5 text-primary" aria-hidden="true" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-surface-sunken/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {t('mainModel', { model: settings?.mainModel ?? '—' })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-vision-model">{t('model')}</Label>
            <Input id="ai-vision-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="qwen-vl-max" dir="ltr" />
            <p className="text-2xs text-muted-foreground">{t('modelHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-vision-url">{t('baseUrl')}</Label>
            <Input
              id="ai-vision-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={settings?.mainBaseUrl ?? 'https://'}
              dir="ltr"
            />
            <p className="text-2xs text-muted-foreground">{t('baseUrlHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-vision-key">{t('apiKey')}</Label>
            <Input
              id="ai-vision-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings?.hasVisionKey ? t('keySaved') : t('keyReuse')}
              dir="ltr"
            />
            {settings?.hasVisionKey && (
              <button type="button" onClick={() => void clearKey()} className="text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {t('clearKey')}
              </button>
            )}
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">{t('allowlist')}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
