'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  TriangleAlert,
  Type,
} from 'lucide-react';
import type { AiAdminStatus, AiProviderName, AiSettingsUpdate } from '@/lib/api/types';
import {
  getAiErrorMessage,
  useAiAdminStatus,
  useReindexAi,
  useTestAiConnection,
  useUpdateAiSettings,
} from '@/hooks/use-ai-assistant';
import { AdminCommandBar, AdminPageHeader, BarButton } from '@/components/admin/admin-chrome';
import {
  Field,
  FieldGrid,
  FormSection,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
  TextInput,
} from '@/components/admin/admin-form';
import { FormLayout, SaveDock, SectionNav } from '@/components/admin/form-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { ease } from '@/lib/motion';
import { AiLearningPanel } from './ai-learning-panel';
import { PaymentSettingsPanel } from './payment-settings-panel';
import { AI_PROVIDER_PRESETS } from '@titan/shared';

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
  const [showKey, setShowKey] = useState(false);
  const [attempted, setAttempted] = useState(false);
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
    // Floor is 256 to match `@Min(256)` on the server DTO and MIN_MAX_TOKENS in the service.
    // It was 1, so a value the form called valid was rejected with a 400 on save.
    isValidNumber(form.maxTokens, 256, 8000, true) &&
    isValidNumber(form.temperature, 0, 2) &&
    isValidNumber(form.retrievalTopK, 1, 50, true) &&
    isValidNumber(form.retrievalMinScore, 0, 1) &&
    isValidNumber(form.maxContextChars, 1000, 100000, true);
  const connectionInvalid = !form.baseUrl.trim() || !form.primaryModel.trim();
  const generationInvalid =
    !isValidNumber(form.timeoutMs, 1000, 120000, true) ||
    !isValidNumber(form.maxTokens, 256, 8000, true) ||
    !isValidNumber(form.temperature, 0, 2);
  const retrievalInvalid =
    !isValidNumber(form.retrievalTopK, 1, 50, true) ||
    !isValidNumber(form.retrievalMinScore, 0, 1) ||
    !isValidNumber(form.maxContextChars, 1000, 100000, true);
  const corpus = settings?.corpus ?? { documents: 0, chunks: 0, embeddedChunks: 0 };
  const operationError =
    statusQuery.error ?? saveMutation.error ?? testMutation.error ?? reindexMutation.error;

  const setField = (key: keyof AiFormState, value: string | boolean) => {
    isDirtyRef.current = true;
    setForm((current) => {
      const next = { ...current, [key]: value };
      /**
       * Choosing a named provider prefills its base URL and model.
       *
       * The assistant speaks the OpenAI chat-completions protocol and DeepSeek implements it,
       * so the two differ only in where they are reached. Without this, selecting "DeepSeek"
       * changed the stored provider while the OpenAI base URL and model stayed put, and every
       * request failed against a host that was never given a key.
       *
       * Only filled when the author has not already typed a value, so switching providers never
       * discards an edit.
       */
      if (key === 'provider') {
        const preset = AI_PROVIDER_PRESETS.find((entry) => entry.id === value);
        if (preset) {
          if (!current.baseUrl.trim()) next.baseUrl = preset.baseUrl;
          if (!current.primaryModel.trim()) next.primaryModel = preset.primaryModel;
        }
      }
      return next;
    });
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

  const discard = () => {
    setForm(currentForm);
    setApiKey('');
    setClearApiKey(false);
    isDirtyRef.current = false;
    setAttempted(false);
    setAction('idle');
    setActionMessage('');
  };

  const save = async () => {
    if (!dirty || saveMutation.isPending) return;
    if (!formValid) {
      // Validation appears after the first attempt; take the author to the first problem.
      setAttempted(true);
      const first = connectionInvalid ? 'connection' : generationInvalid ? 'generation' : 'retrieval';
      document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setAction('idle');
    setActionMessage('');
    try {
      await persistPendingEdits();
      setAttempted(false);
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
      />

      <div className="space-y-6 pt-6">
        <div className="mx-auto w-full max-w-6xl">
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
        </div>

        <FormLayout
          aside={
            <SectionNav
              items={[
                { id: 'connection', label: t('connection'), icon: Sparkles, invalid: attempted && connectionInvalid },
                { id: 'generation', label: t('generation'), icon: SlidersHorizontal, invalid: attempted && generationInvalid },
                { id: 'retrieval', label: t('retrieval'), icon: Search, invalid: attempted && retrievalInvalid },
                { id: 'style', label: t('stylePrompt'), icon: Type },
                { id: 'index', label: t('indexStatus'), icon: Database },
              ]}
            />
          }
        >
          <AnimatePresence initial={false}>
            {!settings.encryptionConfigured && (
              <m.div
                key="encryption"
                role="status"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.emerge } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.16, ease: ease.exit } }}
                className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{t('encryptionRequired')}</span>
              </m.div>
            )}

            {operationError && (
              <m.div
                key="operation-error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.emerge } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.16, ease: ease.exit } }}
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{getAiErrorMessage(operationError, { detailed: true })}</span>
              </m.div>
            )}
          </AnimatePresence>

          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StaggerItem index={0}>
              <Card className="h-full p-5">
                <p className="text-xs font-medium text-muted-foreground">{t('providerStatus')}</p>
                <p className="mt-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Bot className="size-4 text-primary" />
                  {settings.provider}
                </p>
              </Card>
            </StaggerItem>
            <StaggerItem index={1}>
              <Card className="h-full p-5">
                <p className="text-xs font-medium text-muted-foreground">{t('apiKeyStatus')}</p>
                <p className="mt-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
                  {settings.apiKeyConfigured ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <TriangleAlert className="size-4 text-warning" />
                  )}
                  {settings.apiKeyConfigured ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}
                </p>
                {settings.apiKeyMasked && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
                    {settings.apiKeyMasked}
                  </p>
                )}
              </Card>
            </StaggerItem>
            <StaggerItem index={2}>
              <Card className="h-full p-5">
                <p className="text-xs font-medium text-muted-foreground">{t('encryptionStatus')}</p>
                <p className="mt-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
                  {settings.encryptionConfigured ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <TriangleAlert className="size-4 text-warning" />
                  )}
                  {settings.encryptionConfigured ? t('configured') : t('encryptionUnavailable')}
                </p>
              </Card>
            </StaggerItem>
          </Stagger>

          <Reveal>
            <FormSection
              id="connection"
              icon={Sparkles}
              title={t('connection')}
              description={t('connectionDescription')}
            >
              <div className="space-y-5">
                <FieldGrid>
                  <SelectField
                    label={t('provider')}
                    hint={t('providerHint')}
                    value={form.provider}
                    onChange={(event) => setField('provider', event.target.value as AiProviderName)}
                  >
                    <option value="openai-compatible">OpenAI-compatible</option>
                    <option value="deepseek">DeepSeek</option>
                  </SelectField>
                  <TextField
                    label={t('baseUrl')}
                    hint={t('baseUrlHint')}
                    required
                    type="url"
                    dir="ltr"
                    value={form.baseUrl}
                    onChange={(event) => setField('baseUrl', event.target.value)}
                    error={attempted && !form.baseUrl.trim() ? t('requiredError') : undefined}
                  />
                </FieldGrid>

                <FieldGrid>
                  <Field label={t('apiKey')} hint={t('apiKeyHint')}>
                    {(a) => (
                      <>
                        <div className="relative">
                          <TextInput
                            {...a}
                            type={showKey ? 'text' : 'password'}
                            autoComplete="off"
                            spellCheck={false}
                            dir="ltr"
                            className="pe-10 font-mono"
                            value={apiKey}
                            onChange={(event) => {
                              isDirtyRef.current = true;
                              setApiKey(event.target.value);
                              setClearApiKey(false);
                            }}
                            placeholder={
                              clearApiKey
                                ? t('apiKeyWillClear')
                                : settings.apiKeyConfigured
                                  ? (settings.apiKeyMasked ?? '********')
                                  : t('apiKeyPlaceholder')
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey((v) => !v)}
                            aria-pressed={showKey}
                            title={showKey ? t('hideKey') : t('showKey')}
                            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            <span className="sr-only">{showKey ? t('hideKey') : t('showKey')}</span>
                          </button>
                        </div>
                        {clearApiKey && (
                          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-warning">
                            <TriangleAlert className="size-3.5" />
                            {t('apiKeyWillClear')}
                            <button
                              type="button"
                              onClick={() => setClearApiKey(false)}
                              className="font-medium text-foreground underline underline-offset-2"
                            >
                              {t('undoClear')}
                            </button>
                          </p>
                        )}
                        {settings.apiKeyConfigured && !clearApiKey && (
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
                      </>
                    )}
                  </Field>
                  <div className="rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">{t('writeOnlyTitle')}</p>
                    <p>{t('writeOnlyDescription')}</p>
                  </div>
                </FieldGrid>

                <FieldGrid>
                  <TextField
                    label={t('primaryModel')}
                    required
                    dir="ltr"
                    value={form.primaryModel}
                    onChange={(event) => setField('primaryModel', event.target.value)}
                    error={attempted && !form.primaryModel.trim() ? t('requiredError') : undefined}
                  />
                  <TextField
                    label={t('fallbackModel')}
                    hint={t('fallbackHint')}
                    dir="ltr"
                    value={form.fallbackModel}
                    onChange={(event) => setField('fallbackModel', event.target.value)}
                    placeholder={t('optional')}
                  />
                </FieldGrid>

                <FieldGrid>
                  <TextField
                    label={t('embeddingModel')}
                    hint={t('embeddingHint')}
                    dir="ltr"
                    value={form.embeddingModel}
                    onChange={(event) => setField('embeddingModel', event.target.value)}
                    placeholder={t('optional')}
                  />
                  <TextField
                    label={t('embeddingBaseUrl')}
                    type="url"
                    dir="ltr"
                    value={form.embeddingBaseUrl}
                    onChange={(event) => setField('embeddingBaseUrl', event.target.value)}
                    placeholder={form.baseUrl}
                  />
                </FieldGrid>

                <FieldGrid>
                  <SwitchField
                    label={t('enabled')}
                    description={t('enabledHint')}
                    checked={form.enabled}
                    onCheckedChange={(checked) => setField('enabled', checked)}
                  />
                  <SwitchField
                    label={t('publicEnabled')}
                    description={t('publicEnabledHint')}
                    checked={form.publicEnabled}
                    disabled={!form.enabled}
                    className={cn('transition-opacity duration-200', !form.enabled && 'opacity-60')}
                    onCheckedChange={(checked) => setField('publicEnabled', checked)}
                  />
                </FieldGrid>
              </div>
            </FormSection>
          </Reveal>

          <Reveal>
            <FormSection
              id="generation"
              icon={SlidersHorizontal}
              title={t('generation')}
              description={t('generationDescription')}
            >
              <FieldGrid cols={3}>
                <NumField label={t('timeout')} value={form.timeoutMs} min={1000} max={120000} step={1000} integer attempted={attempted} onChange={(v) => setField('timeoutMs', v)} />
                <NumField label={t('maxTokens')} value={form.maxTokens} min={256} max={8000} step={1} integer attempted={attempted} onChange={(v) => setField('maxTokens', v)} />
                <NumField label={t('temperature')} value={form.temperature} min={0} max={2} step={0.1} attempted={attempted} onChange={(v) => setField('temperature', v)} />
              </FieldGrid>
            </FormSection>
          </Reveal>

          <Reveal>
            <FormSection
              id="retrieval"
              icon={Search}
              title={t('retrieval')}
              description={t('retrievalDescription')}
            >
              <FieldGrid cols={3}>
                <NumField label={t('topK')} value={form.retrievalTopK} min={1} max={50} step={1} integer attempted={attempted} onChange={(v) => setField('retrievalTopK', v)} />
                <NumField label={t('minScore')} value={form.retrievalMinScore} min={0} max={1} step={0.05} attempted={attempted} onChange={(v) => setField('retrievalMinScore', v)} />
                <NumField label={t('maxContextChars')} value={form.maxContextChars} min={1000} max={100000} step={1000} integer attempted={attempted} onChange={(v) => setField('maxContextChars', v)} />
              </FieldGrid>
            </FormSection>
          </Reveal>

          <Reveal>
            <FormSection
              id="style"
              icon={Type}
              title={t('stylePrompt')}
              description={t('stylePromptHint')}
              badge={t('optional')}
            >
              <TextAreaField
                label={t('stylePrompt')}
                value={form.systemStyle}
                onChange={(event) => setField('systemStyle', event.target.value)}
                placeholder={t('stylePlaceholder')}
                maxLength={2000}
                rows={5}
              />
            </FormSection>
          </Reveal>

          <Reveal>
            <FormSection
              id="index"
              icon={Database}
              title={t('indexStatus')}
              description={t('indexDescription')}
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['documents', corpus.documents],
                      ['chunks', corpus.chunks],
                      ['embeddedChunks', corpus.embeddedChunks],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-muted/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t(key)}</p>
                      <AnimatedNumber
                        value={value}
                        animateOnChange
                        className="mt-1 block font-display text-2xl font-medium tabular-nums tracking-[-0.015em] text-foreground"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t('lastIndex')}</p>
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
                    <p className="text-xs font-medium text-muted-foreground">{t('lastTested')}</p>
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
              </div>
            </FormSection>
          </Reveal>

          <PaymentSettingsPanel />

          <AiLearningPanel />

          <AnimatePresence initial={false}>
            {actionMessage && (
              <m.div
                key="action-message"
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.emerge } }}
                exit={{ opacity: 0, y: 4, transition: { duration: 0.16, ease: ease.exit } }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-3.5 text-sm',
                  action === 'error'
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-success/30 bg-success/10 text-success',
                )}
              >
                {action === 'error' ? (
                  <TriangleAlert className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {actionMessage}
              </m.div>
            )}
          </AnimatePresence>
        </FormLayout>
      </div>

      <SaveDock
        mode="edit"
        dirty={dirty}
        saving={saveMutation.isPending}
        failed={action === 'error'}
        onSave={() => void save()}
        onDiscard={discard}
        saveLabel={t('save')}
        savingLabel={t('saving')}
      />
    </div>
  );
}

/** A numeric setting with its range enforced inline once a save was attempted. */
function NumField({
  label,
  value,
  min,
  max,
  step,
  integer = false,
  attempted,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  attempted: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('aiAssistant');
  const bad = attempted && !isValidNumber(value, min, max, integer);
  return (
    <TextField
      label={label}
      type="number"
      dir="ltr"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={bad ? t('rangeError', { min, max }) : undefined}
    />
  );
}
