'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bot,
  CheckCircle2,
  Database,
  RefreshCw,
  Save,
  Sparkles,
  TestTube2,
  TriangleAlert,
} from 'lucide-react';
import type { AiAdminStatus, AiProviderName, AiSettingsUpdate } from '@/lib/api/types';
import {
  getAiErrorMessage,
  useAiAdminStatus,
  useReindexAi,
  useTestAiConnection,
  useUpdateAiSettings,
} from '@/hooks/use-ai-assistant';
import {
  AdminCommandBar,
  AdminPageHeader,
  BarButton,
  BarPrimaryButton,
} from '@/components/admin/admin-chrome';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { AiLearningPanel } from './ai-learning-panel';
import { PaymentSettingsPanel } from './payment-settings-panel';

const REINDEX_STORAGE_KEY = 'ai-assistant-last-reindex';

type AiFormState = {
  provider: AiProviderName;
  baseUrl: string;
  primaryModel: string;
  fallbackModel: string;
  embeddingModel: string;
  embeddingBaseUrl: string;
  enabled: boolean;
  publicEnabled: boolean;
  timeoutMs: string;
  maxTokens: string;
  temperature: string;
  retrievalTopK: string;
  retrievalMinScore: string;
  maxContextChars: string;
  systemStyle: string;
};

type ReindexRecord = {
  at: string;
  documents?: number;
  chunks?: number;
  embeddedChunks?: number;
  error?: string;
};

const EMPTY_FORM: AiFormState = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  primaryModel: 'gpt-4o-mini',
  fallbackModel: '',
  embeddingModel: '',
  embeddingBaseUrl: '',
  enabled: false,
  publicEnabled: false,
  timeoutMs: '15000',
  maxTokens: '800',
  temperature: '0.2',
  retrievalTopK: '8',
  retrievalMinScore: '0.2',
  maxContextChars: '12000',
  systemStyle: '',
};

function toForm(settings: AiAdminStatus): AiFormState {
  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    primaryModel: settings.primaryModel,
    fallbackModel: settings.fallbackModel ?? '',
    embeddingModel: settings.embeddingModel ?? '',
    embeddingBaseUrl: settings.embeddingBaseUrl ?? '',
    enabled: settings.enabled,
    publicEnabled: settings.publicEnabled,
    timeoutMs: String(settings.timeoutMs),
    maxTokens: String(settings.maxTokens),
    temperature: String(settings.temperature),
    retrievalTopK: String(settings.retrievalTopK),
    retrievalMinScore: String(settings.retrievalMinScore),
    maxContextChars: String(settings.maxContextChars),
    systemStyle: settings.systemStyle ?? '',
  };
}

function parseNumber(value: string): number {
  return Number(value);
}

function isValidNumber(value: string, min: number, max: number, integer = false): boolean {
  const parsed = parseNumber(value);
  return (
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed))
  );
}

function readReindexRecord(): ReindexRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REINDEX_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || typeof (value as { at?: unknown }).at !== 'string')
      return null;
    return value as ReindexRecord;
  } catch {
    return null;
  }
}

function writeReindexRecord(record: ReindexRecord) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REINDEX_STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AiAssistantSettingsPage() {
  const t = useTranslations('aiAssistant');
  const tAdmin = useTranslations('admin');
  const statusQuery = useAiAdminStatus();
  const saveMutation = useUpdateAiSettings();
  const testMutation = useTestAiConnection();
  const reindexMutation = useReindexAi();
  const [settings, setSettings] = useState<AiAdminStatus | null>(null);
  const [form, setForm] = useState<AiFormState>(EMPTY_FORM);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [action, setAction] = useState<'idle' | 'success' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState('');
  const [reindexRecord, setReindexRecord] = useState<ReindexRecord | null>(readReindexRecord);
  const initialized = useRef(false);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!statusQuery.data) return;
    setSettings(statusQuery.data);
    if (initialized.current && isDirtyRef.current) return;
    setForm(toForm(statusQuery.data));
    setApiKey('');
    setClearApiKey(false);
    isDirtyRef.current = false;
    initialized.current = true;
  }, [statusQuery.data]);

  const currentForm = useMemo(() => (settings ? toForm(settings) : EMPTY_FORM), [settings]);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(currentForm) || apiKey.trim().length > 0 || clearApiKey,
    [apiKey, clearApiKey, currentForm, form],
  );
  const formValid =
    form.baseUrl.trim().length > 0 &&
    form.primaryModel.trim().length > 0 &&
    isValidNumber(form.timeoutMs, 1000, 120000, true) &&
    isValidNumber(form.maxTokens, 1, 8000, true) &&
    isValidNumber(form.temperature, 0, 2) &&
    isValidNumber(form.retrievalTopK, 1, 50, true) &&
    isValidNumber(form.retrievalMinScore, 0, 1) &&
    isValidNumber(form.maxContextChars, 1000, 100000, true);
  const corpus = settings?.corpus ?? { documents: 0, chunks: 0, embeddedChunks: 0 };
  const operationError =
    statusQuery.error ?? saveMutation.error ?? testMutation.error ?? reindexMutation.error;

  const setField = (key: keyof AiFormState, value: string | boolean) => {
    isDirtyRef.current = true;
    setForm((current) => ({ ...current, [key]: value }));
    setAction('idle');
    setActionMessage('');
  };

const buildPayload = (): AiSettingsUpdate => {
    const enteredKey = apiKey.trim();
    return {
      provider: form.provider,
      baseUrl: form.baseUrl.trim(),
      primaryModel: form.primaryModel.trim(),
      fallbackModel: form.fallbackModel.trim() || null,
      embeddingModel: form.embeddingModel.trim() || null,
      embeddingBaseUrl: form.embeddingBaseUrl.trim() || null,
      enabled: form.enabled,
      publicEnabled: form.enabled && form.publicEnabled,
      timeoutMs: parseNumber(form.timeoutMs),
      maxTokens: parseNumber(form.maxTokens),
      temperature: parseNumber(form.temperature),
      retrievalTopK: parseNumber(form.retrievalTopK),
      retrievalMinScore: parseNumber(form.retrievalMinScore),
      maxContextChars: parseNumber(form.maxContextChars),
      systemStyle: form.systemStyle.trim() || null,
      ...(enteredKey ? { apiKey: enteredKey } : clearApiKey ? { apiKey: '' } : {}),
    };
  };

  /** Push unsaved edits so a subsequent test runs against what is on screen. */
  const persistPendingEdits = async (): Promise<void> => {
    if (!dirty || !formValid) return;
    const next = await saveMutation.mutateAsync(buildPayload());
    setApiKey('');
    setClearApiKey(false);
    isDirtyRef.current = false;
    if (settings) {
      const nextSettings = { ...settings, ...next };
      setSettings(nextSettings);
      setForm(toForm(nextSettings));
    }
  };

  const save = async () => {
    if (!dirty || !formValid || saveMutation.isPending) return;
    setAction('idle');
    setActionMessage('');
    try {
      await persistPendingEdits();
      setAction('success');
      setActionMessage(t('saved'));
      toast({ type: 'ok', title: t('saved') });
    } catch (error) {
      setAction('error');
      setActionMessage(getAiErrorMessage(error, { detailed: true }));
      toast({ type: 'err', title: t('saveFailed'), description: getAiErrorMessage(error, { detailed: true }) });
    } finally {
      saveMutation.reset();
    }
  };

  const testConnection = async () => {
    if (testMutation.isPending) return;
    setAction('idle');
    setActionMessage('');
    // Clear the previous failure so a stale banner never masks this attempt.
    testMutation.reset();
    try {
      // The server tests the *stored* config, so flush pending edits first —
      // otherwise editing the base URL and pressing Test silently retests the old one.
      await persistPendingEdits();
      const result = await testMutation.mutateAsync();
      setAction('success');
      setActionMessage(`${t('testSuccess')} · ${result.latencyMs}ms`);
      toast({ type: 'ok', title: t('testSuccess') });
    } catch (error) {
      setAction('error');
      setActionMessage(getAiErrorMessage(error, { detailed: true }));
      toast({ type: 'err', title: t('testFailed'), description: getAiErrorMessage(error, { detailed: true }) });
    } finally {
      saveMutation.reset();
    }
  };

  const reindex = async () => {
    if (reindexMutation.isPending) return;
    setAction('idle');
    setActionMessage('');
    try {
      const result = await reindexMutation.mutateAsync();
      const record: ReindexRecord = {
        at: new Date().toISOString(),
        documents: result.documents,
        chunks: result.chunks,
        embeddedChunks: result.embeddedChunks,
      };
      setReindexRecord(record);
      writeReindexRecord(record);
      setAction('success');
      setActionMessage(t('reindexSuccess'));
      toast({ type: 'ok', title: t('reindexSuccess') });
    } catch (error) {
      const record: ReindexRecord = {
        at: new Date().toISOString(),
        error: getAiErrorMessage(error, { detailed: true }),
      };
      setReindexRecord(record);
      writeReindexRecord(record);
      setAction('error');
      setActionMessage(getAiErrorMessage(error, { detailed: true }));
      toast({ type: 'err', title: t('reindexFailed'), description: getAiErrorMessage(error, { detailed: true }) });
    }
  };

  if (statusQuery.isLoading && !settings) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <LoadingState label={t('loading')} rows={5} />
      </div>
    );
  }

  if (statusQuery.isError && !settings) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState
          title={t('loadFailed')}
          description={getAiErrorMessage(statusQuery.error, { detailed: true })}
          onRetry={() => void statusQuery.refetch()}
        />
      </div>
    );
  }

  if (!settings) return null;

  const statusVariant =
    settings.status === 'ready'
      ? 'success'
      : settings.status === 'error'
        ? 'destructive'
        : settings.status === 'disabled'
          ? 'soft-muted'
          : 'warning';

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: tAdmin('settings'), href: '/admin/settings' }, { label: t('title') }]}
        live={false}
        actions={
          <BarButton
            icon={<RefreshCw className="size-4" />}
            onClick={() => void statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            {t('refresh')}
          </BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={<Save className="size-4" />}
            onClick={() => void save()}
            disabled={!dirty || !formValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? t('saving') : t('save')}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 pt-6">
        <AdminPageHeader
          title={t('title')}
          description={t('description')}
          badge={
            <Badge variant={statusVariant} className="self-start md:self-auto">
              {settings.status === 'ready'
                ? t('ready')
                : settings.status === 'error'
                  ? t('notReady')
                  : t('notConfigured')}
            </Badge>
          }
        />

        {!settings.encryptionConfigured && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{t('encryptionRequired')}</span>
          </div>
        )}

        {operationError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{getAiErrorMessage(operationError, { detailed: true })}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('providerStatus')}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-primary" />
              {settings.provider}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('apiKeyStatus')}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
              {settings.apiKeyConfigured ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <TriangleAlert className="size-4 text-warning" />
              )}
              {settings.apiKeyConfigured ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}
            </p>
            {settings.apiKeyMasked && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {settings.apiKeyMasked}
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('encryptionStatus')}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
              {settings.encryptionConfigured ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <TriangleAlert className="size-4 text-warning" />
              )}
              {settings.encryptionConfigured ? t('configured') : t('encryptionUnavailable')}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-primary" />
              {t('connection')}
            </CardTitle>
            <CardDescription>{t('connectionDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t('provider')} htmlFor="ai-provider" hint={t('providerHint')}>
                <select
                  id="ai-provider"
                  value={form.provider}
                  onChange={(event) => setField('provider', event.target.value as AiProviderName)}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="openai-compatible">OpenAI-compatible</option>
                </select>
              </Field>
              <Field label={t('baseUrl')} htmlFor="ai-base-url" hint={t('baseUrlHint')}>
                <Input
                  id="ai-base-url"
                  type="url"
                  value={form.baseUrl}
                  onChange={(event) => setField('baseUrl', event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t('apiKey')} htmlFor="ai-api-key" hint={t('apiKeyHint')}>
                <Input
                  id="ai-api-key"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                    onChange={(event) => {
                      isDirtyRef.current = true;
                      setApiKey(event.target.value);
                      setClearApiKey(false);
                    }}
                   placeholder={
                     settings.apiKeyConfigured
                       ? (settings.apiKeyMasked ?? '********')
                       : t('apiKeyPlaceholder')
                   }
                 />
                 {settings.apiKeyConfigured && (
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="mt-2 px-0 text-xs text-destructive hover:text-destructive"
                     onClick={() => {
                       isDirtyRef.current = true;
                       setApiKey('');
                       setClearApiKey(true);
                     }}
                   >
                     {t('clearApiKey')}
                   </Button>
                 )}
               </Field>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">{t('writeOnlyTitle')}</p>
                <p>{t('writeOnlyDescription')}</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t('primaryModel')} htmlFor="ai-primary-model">
                <Input
                  id="ai-primary-model"
                  value={form.primaryModel}
                  onChange={(event) => setField('primaryModel', event.target.value)}
                />
              </Field>
              <Field
                label={t('fallbackModel')}
                htmlFor="ai-fallback-model"
                hint={t('fallbackHint')}
              >
                <Input
                  id="ai-fallback-model"
                  value={form.fallbackModel}
                  onChange={(event) => setField('fallbackModel', event.target.value)}
                  placeholder={t('optional')}
                />
              </Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t('embeddingModel')} htmlFor="ai-embedding-model" hint={t('embeddingHint')}>
                <Input
                  id="ai-embedding-model"
                  value={form.embeddingModel}
                  onChange={(event) => setField('embeddingModel', event.target.value)}
                  placeholder={t('optional')}
                />
              </Field>
              <Field label={t('embeddingBaseUrl')} htmlFor="ai-embedding-base-url">
                <Input
                  id="ai-embedding-base-url"
                  type="url"
                  value={form.embeddingBaseUrl}
                  onChange={(event) => setField('embeddingBaseUrl', event.target.value)}
                  placeholder={form.baseUrl}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                <div>
                  <Label htmlFor="ai-enabled">{t('enabled')}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t('enabledHint')}</p>
                </div>
                <Switch
                  id="ai-enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) => setField('enabled', checked)}
                />
              </div>
              <div
                className={cn(
                  'flex items-center justify-between rounded-md border border-border bg-card p-3',
                  !form.enabled && 'opacity-60',
                )}
              >
                <div>
                  <Label htmlFor="ai-public-enabled">{t('publicEnabled')}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t('publicEnabledHint')}</p>
                </div>
                <Switch
                  id="ai-public-enabled"
                  checked={form.publicEnabled}
                  disabled={!form.enabled}
                  onCheckedChange={(checked) => setField('publicEnabled', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-sm">{t('generation')}</CardTitle>
            <CardDescription>{t('generationDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('timeout')} htmlFor="ai-timeout">
              <Input
                id="ai-timeout"
                type="number"
                min={1000}
                max={120000}
                step={1000}
                value={form.timeoutMs}
                onChange={(event) => setField('timeoutMs', event.target.value)}
              />
            </Field>
            <Field label={t('maxTokens')} htmlFor="ai-max-tokens">
              <Input
                id="ai-max-tokens"
                type="number"
                min={1}
                max={8000}
                step={1}
                value={form.maxTokens}
                onChange={(event) => setField('maxTokens', event.target.value)}
              />
            </Field>
            <Field label={t('temperature')} htmlFor="ai-temperature">
              <Input
                id="ai-temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={form.temperature}
                onChange={(event) => setField('temperature', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-sm">{t('retrieval')}</CardTitle>
            <CardDescription>{t('retrievalDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
            <Field label={t('topK')} htmlFor="ai-top-k">
              <Input
                id="ai-top-k"
                type="number"
                min={1}
                max={50}
                step={1}
                value={form.retrievalTopK}
                onChange={(event) => setField('retrievalTopK', event.target.value)}
              />
            </Field>
            <Field label={t('minScore')} htmlFor="ai-min-score">
              <Input
                id="ai-min-score"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={form.retrievalMinScore}
                onChange={(event) => setField('retrievalMinScore', event.target.value)}
              />
            </Field>
            <Field label={t('maxContextChars')} htmlFor="ai-max-context">
              <Input
                id="ai-max-context"
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={form.maxContextChars}
                onChange={(event) => setField('maxContextChars', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-sm">{t('stylePrompt')}</CardTitle>
            <CardDescription>{t('stylePromptHint')}</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <Textarea
              value={form.systemStyle}
              onChange={(event) => setField('systemStyle', event.target.value)}
              placeholder={t('stylePlaceholder')}
              maxLength={2000}
              rows={5}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="size-4 text-primary" />
              {t('indexStatus')}
            </CardTitle>
            <CardDescription>{t('indexDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t('documents')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{corpus.documents}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t('chunks')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{corpus.chunks}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t('embeddedChunks')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{corpus.embeddedChunks}</p>
              </div>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('lastIndex')}
                </p>
                <p className="mt-1">
                  {settings.lastIndexedAt
                    ? formatDate(settings.lastIndexedAt)
                    : reindexRecord?.at
                      ? formatDate(reindexRecord.at)
                      : t('neverIndexed')}
                </p>
                {(settings.lastIndexedAt || reindexRecord?.at) && !settings.lastIndexError && !reindexRecord?.error && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settings.lastIndexDocuments || reindexRecord?.documents || corpus.documents} {t('documents')} ·{' '}
                    {settings.lastIndexChunks || reindexRecord?.chunks || corpus.chunks} {t('chunks')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('lastTested')}
                </p>
                <p className="mt-1">
                  {settings.lastTestedAt ? formatDate(settings.lastTestedAt) : t('neverTested')}
                </p>
              </div>
            </div>
            {reindexRecord?.error && (
              <p role="alert" className="text-sm text-destructive">
                {t('indexError')}: {reindexRecord.error}
              </p>
            )}
            {settings.lastIndexError && (
              <p role="alert" className="text-sm text-destructive">
                {t('indexError')}: {settings.lastIndexError}
              </p>
            )}
            {settings.lastErrorCode && (
              <p role="alert" className="text-sm text-destructive">
                {t('lastError')}: {settings.lastErrorCode}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void testConnection()}
                 disabled={testMutation.isPending || !settings.apiKeyConfigured || !formValid}
                loading={testMutation.isPending}
              >
                <TestTube2 />
                {testMutation.isPending ? t('testing') : t('testConnection')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void reindex()}
                disabled={reindexMutation.isPending}
                loading={reindexMutation.isPending}
              >
                <RefreshCw />
                {reindexMutation.isPending ? t('reindexing') : t('reindex')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <PaymentSettingsPanel />

        <AiLearningPanel />

        {actionMessage && (
          <div
            role="status"
            className={cn(
              'flex items-center gap-2 rounded-lg border p-3 text-sm',
              action === 'error'
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-success/30 bg-success/5 text-success',
            )}
          >
            {action === 'error' ? (
              <TriangleAlert className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {actionMessage}
          </div>
        )}
      </div>
    </div>
  );
}
