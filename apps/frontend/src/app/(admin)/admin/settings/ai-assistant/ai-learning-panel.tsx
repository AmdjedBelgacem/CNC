'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  BarChart3,
  Globe,
  PlayCircle,
  Save,
  TestTube2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  getAiErrorMessage,
  useAiEvalRuns,
  useAiFeedbackSummary,
  useAiWebSearchSettings,
  useRunAiEval,
  useTestAiWebSearch,
  useUpdateAiWebSearch,
} from '@/hooks/use-ai-assistant';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import type { AiWebSearchProvider } from '@/lib/api/types';

const PROVIDERS: Array<{ value: AiWebSearchProvider; label: string }> = [
  { value: 'none', label: '—' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'serper', label: 'Serper' },
];

const MODES = ['general', 'fact_check', 'ask_post', 'ask_lesson'] as const;

type WebForm = {
  provider: AiWebSearchProvider;
  apiKey: string;
  enabled: boolean;
  maxResults: string;
  timeoutMs: string;
  cacheTtlSeconds: string;
  domains: string;
  modes: string[];
};

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

/**
 * Two panels that answer the questions an administrator actually has:
 * "can it check things outside TITANS?" and "is it getting better, or are we
 * just guessing?" The second one is why the thumbs in the chat UI exist.
 */
export function AiLearningPanel() {
  const t = useTranslations('aiAdmin');
  const ta = useTranslations('aiAssistant');

  const webSearch = useAiWebSearchSettings();
  const updateWeb = useUpdateAiWebSearch();
  const testWeb = useTestAiWebSearch();
  const feedback = useAiFeedbackSummary();
  const runs = useAiEvalRuns();
  const runEval = useRunAiEval();

  const [form, setForm] = useState<WebForm | null>(null);
  const [evalLabel, setEvalLabel] = useState('');

  useEffect(() => {
    const data = webSearch.data?.data;
    if (!data) return;
    setForm({
      provider: data.provider,
      apiKey: '',
      enabled: data.enabled,
      maxResults: String(data.maxResults),
      timeoutMs: String(data.timeoutMs),
      cacheTtlSeconds: String(data.cacheTtlSeconds),
      domains: data.allowedDomains.join('\n'),
      modes: data.allowedModes,
    });
  }, [webSearch.data?.data]);

  const saveWeb = async () => {
    if (!form) return;
    const maxResults = Number(form.maxResults);
    const timeoutMs = Number(form.timeoutMs);
    const cacheTtlSeconds = Number(form.cacheTtlSeconds);
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 10) {
      toast({ type: 'err', title: `${t('searchMaxResults')}: 1–10` });
      return;
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
      toast({ type: 'err', title: `${t('searchTimeout')}: 1000–30000` });
      return;
    }
    try {
      await updateWeb.mutateAsync({
        provider: form.provider,
        enabled: form.enabled,
        maxResults,
        timeoutMs,
        cacheTtlSeconds: Number.isInteger(cacheTtlSeconds) ? cacheTtlSeconds : 3600,
        allowedDomains: form.domains
          .split('\n')
          .map((line) => line.trim().toLowerCase())
          .filter(Boolean),
        allowedModes: form.modes,
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      });
      setForm((current) => (current ? { ...current, apiKey: '' } : current));
      toast({ type: 'ok', title: ta('saved') });
    } catch (error) {
      toast({ type: 'err', title: getAiErrorMessage(error) });
    }
  };

  const testWebSearch = async () => {
    try {
      const result = await testWeb.mutateAsync();
      const data = result.data;
      if (data.ok) toast({ type: 'ok', title: `${t('searchTestOk')} (${data.resultCount ?? 0})` });
      else toast({ type: 'err', title: `${t('searchTestFailed')}: ${data.code ?? 'unknown'}` });
    } catch (error) {
      toast({ type: 'err', title: getAiErrorMessage(error) });
    }
  };

  const executeEval = async () => {
    const label = evalLabel.trim() || `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`;
    try {
      const result = await runEval.mutateAsync({ label });
      const data = result.data;
      toast({ type: 'ok', title: `${data.passedCases}/${data.totalCases} · ${percent(data.score)}` });
      setEvalLabel('');
    } catch (error) {
      toast({ type: 'err', title: getAiErrorMessage(error) });
    }
  };

  const summary = feedback.data?.data.summary;
  const latest = runs.data?.data[0];
  const previous = runs.data?.data[1];

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe className="size-4" />
            {t('webSearch')}
          </CardTitle>
          <CardDescription>{t('webSearchHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webSearch.isPending ? (
            <LoadingState label={ta('loading')} />
          ) : webSearch.isError ? (
            <ErrorState title={ta('loadFailed')} onRetry={() => void webSearch.refetch()} compact />
          ) : !form ? null : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-search-provider">{t('searchProvider')}</Label>
                  <select
                    id="ai-search-provider"
                    value={form.provider}
                    onChange={(event) =>
                      setForm({ ...form, provider: event.target.value as AiWebSearchProvider })
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {PROVIDERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-search-key">{t('searchKey')}</Label>
                  <Input
                    id="ai-search-key"
                    type="password"
                    autoComplete="off"
                    value={form.apiKey}
                    onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                    placeholder={
                      webSearch.data?.data.apiKeyConfigured
                        ? t('searchKeyConfigured')
                        : t('searchKeyMissing')
                    }
                  />
                  <p className="text-2xs text-muted-foreground">{t('searchKeyHint')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('searchEnabled')}</p>
                  <p className="text-xs text-muted-foreground">{t('searchEnabledHint')}</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
                  aria-label={t('searchEnabled')}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t('searchModes')}</legend>
                <div className="flex flex-wrap gap-3">
                  {MODES.map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.modes.includes(mode)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            modes: event.target.checked
                              ? [...form.modes, mode]
                              : form.modes.filter((entry) => entry !== mode),
                          })
                        }
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-search-max">{t('searchMaxResults')}</Label>
                  <Input
                    id="ai-search-max"
                    inputMode="numeric"
                    value={form.maxResults}
                    onChange={(event) => setForm({ ...form, maxResults: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-search-timeout">{t('searchTimeout')}</Label>
                  <Input
                    id="ai-search-timeout"
                    inputMode="numeric"
                    value={form.timeoutMs}
                    onChange={(event) => setForm({ ...form, timeoutMs: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-search-ttl">{t('searchCacheTtl')}</Label>
                  <Input
                    id="ai-search-ttl"
                    inputMode="numeric"
                    value={form.cacheTtlSeconds}
                    onChange={(event) => setForm({ ...form, cacheTtlSeconds: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-search-domains">{t('searchDomains')}</Label>
                <textarea
                  id="ai-search-domains"
                  rows={3}
                  value={form.domains}
                  onChange={(event) => setForm({ ...form, domains: event.target.value })}
                  placeholder="example.com&#10;docs.example.org"
                  className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                />
                <p className="text-2xs text-muted-foreground">{t('searchDomainsHint')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void saveWeb()}
                  disabled={updateWeb.isPending}
                  loading={updateWeb.isPending}
                >
                  <Save />
                  {ta('save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void testWebSearch()}
                  disabled={testWeb.isPending || !webSearch.data?.data.apiKeyConfigured}
                  loading={testWeb.isPending}
                >
                  <TestTube2 />
                  {testWeb.isPending ? t('testingSearch') : t('testSearch')}
                </Button>
                {webSearch.data?.data.lastErrorCode && (
                  <Badge variant="outline" className="text-destructive">
                    {webSearch.data.data.lastErrorCode}
                  </Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ThumbsUp className="size-4" />
            {t('feedback')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.isPending ? (
            <LoadingState label={ta('loading')} />
          ) : feedback.isError ? (
            <ErrorState title={ta('loadFailed')} onRetry={() => void feedback.refetch()} compact />
          ) : !summary || summary.total === 0 ? (
            <p className="text-sm text-muted-foreground">{t('feedbackNoData')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label={t('feedbackTotal')} value={String(summary.total)} />
              <Stat
                label={t('feedbackScore')}
                value={summary.score > 0 ? `+${percent(summary.score)}` : percent(summary.score)}
              />
              <Stat label="👍" value={String(summary.helpful)} />
              <Stat
                label={t('feedbackWebRate')}
                value={summary.webAnswered === 0 ? '—' : percent(summary.webHelpfulRate)}
              />
            </div>
          )}

          {(feedback.data?.data.recent.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-2">
              {feedback.data!.data.recent.slice(0, 6).map((vote) => (
                <li key={vote.messageId} className="flex items-start gap-2 text-xs">
                  {vote.rating > 0 ? (
                    <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <ThumbsDown className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{vote.content}</span>
                  {vote.usedWeb && <Globe className="mt-0.5 size-3 shrink-0 text-muted-foreground" />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4" />
            {t('evals')}
          </CardTitle>
          <CardDescription>{t('evalsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="ai-eval-label">{t('evalLabel')}</Label>
              <Input
                id="ai-eval-label"
                value={evalLabel}
                onChange={(event) => setEvalLabel(event.target.value)}
                placeholder="web-on"
              />
              <p className="text-2xs text-muted-foreground">{t('evalLabelHint')}</p>
            </div>
            <Button
              type="button"
              onClick={() => void executeEval()}
              disabled={runEval.isPending}
              loading={runEval.isPending}
            >
              <PlayCircle />
              {runEval.isPending ? t('runningEval') : t('runEval')}
            </Button>
          </div>

          {runs.isPending ? (
            <LoadingState label={ta('loading')} />
          ) : (runs.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noEvalRuns')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pe-3">{t('evalLabel')}</th>
                    <th className="py-2 pe-3">{t('evalScore')}</th>
                    <th className="py-2 pe-3">{t('evalPassed')}</th>
                    <th className="py-2 pe-3">{t('evalGroundedness')}</th>
                    <th className="py-2 pe-3">{t('evalCitations')}</th>
                    <th className="py-2 pe-3">{t('evalLatency')}</th>
                    <th className="py-2 pe-3">{t('evalPromptVersion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data!.data.map((run) => {
                    const isLatest = latest?.id === run.id;
                    const delta =
                      isLatest && previous ? run.score - previous.score : null;
                    return (
                      <tr key={run.id} className="border-t border-border">
                        <td className="py-2 pe-3">
                          <span className="font-medium text-foreground">{run.label}</span>
                          {run.webEnabled && (
                            <Globe className="ms-1.5 inline size-3 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">
                          {percent(run.score)}
                          {delta !== null && delta !== 0 && (
                            <span
                              className={delta > 0 ? 'ms-1 text-success' : 'ms-1 text-destructive'}
                            >
                              {delta > 0 ? '+' : ''}
                              {Math.round(delta * 100)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">
                          {run.passedCases}/{run.totalCases}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">{percent(run.groundedness)}</td>
                        <td className="py-2 pe-3 tabular-nums">{percent(run.citationCoverage)}</td>
                        <td className="py-2 pe-3 tabular-nums">{run.avgLatencyMs}ms</td>
                        <td className="py-2 pe-3 font-mono text-2xs text-muted-foreground">
                          {run.promptVersion}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {latest && (
            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Activity className="size-3" />
              {t('evalPrevious')}: {previous ? `${previous.label} (${percent(previous.score)})` : '—'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
