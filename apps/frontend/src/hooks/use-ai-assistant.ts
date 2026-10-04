'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api-client';
import { coerceLocale } from '@/i18n/config';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AiAdminStatus,
  AiChatRequest,
  AiChatResponse,
  AiConversation,
  AiConversationSummary,
  AiCorpusStats,
  AiMaskedSettings,
  AiPublicConfig,
  AiSettingsUpdate,
  AiTestResponse,
  AiEvalCase,
  AiEvalRun,
  AiFeedbackSummary,
  AiLearningSnapshot,
  AiWebSearchSettings,
  AiWebSearchSettingsUpdate,
} from '@/lib/api/types';

export const aiKeys = {
  all: ['ai-assistant'] as const,
  publicConfig: () => [...aiKeys.all, 'public-config'] as const,
  adminStatus: () => [...aiKeys.all, 'admin-status'] as const,
  conversations: () => [...aiKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...aiKeys.conversations(), id] as const,
  feedback: () => [...aiKeys.all, 'feedback'] as const,
  feedbackSummary: () => [...aiKeys.all, 'feedback', 'summary'] as const,
  webSearch: () => [...aiKeys.all, 'web-search'] as const,
  evalCases: () => [...aiKeys.all, 'eval', 'cases'] as const,
  evalRuns: () => [...aiKeys.all, 'eval', 'runs'] as const,
  learning: () => [...aiKeys.all, 'learning'] as const,
};

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_LENGTH = 2000;
const MAX_CONTEXT_ID_LENGTH = 128;

function contextId(value: string): string | null {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized ? normalized.slice(0, MAX_CONTEXT_ID_LENGTH) : null;
}

function buildChatPayload(input: AiChatRequest) {
  const contextCourseId = input.pageContext ? contextId(input.pageContext.courseId) : null;
  const contextLessonId = input.pageContext ? contextId(input.pageContext.lessonId) : null;
  const pageContext = contextCourseId && contextLessonId
    ? { courseId: contextCourseId, lessonId: contextLessonId }
    : undefined;
  const history = (input.history ?? [])
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_HISTORY_LENGTH) }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_ITEMS);
  const conversationId = input.conversationId?.trim().slice(0, 100);
  const sourceRef = input.sourceRef
    ? {
        type: String(input.sourceRef.type || 'page').slice(0, 32),
        id: String(input.sourceRef.id || '').slice(0, 64),
        ...(input.sourceRef.href ? { href: String(input.sourceRef.href).slice(0, 300) } : {}),
        ...(input.sourceRef.title ? { title: String(input.sourceRef.title).slice(0, 300) } : {}),
        ...(input.sourceRef.author ? { author: String(input.sourceRef.author).slice(0, 200) } : {}),
        ...(input.sourceRef.excerpt
          ? { excerpt: String(input.sourceRef.excerpt).slice(0, 4000) }
          : {}),
      }
    : undefined;
  return {
    message: input.message.trim().slice(0, MAX_MESSAGE_LENGTH),
    locale: input.locale === 'ar' ? 'ar' : 'en',
    ...(pageContext ? { pageContext } : {}),
    ...(history.length > 0 ? { history } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(sourceRef && sourceRef.id ? { sourceRef } : {}),
  };
}

/** Human-readable labels for the AI provider error codes the backend can emit. */
const AI_ERROR_CODE_HINTS: Record<string, string> = {
  http_error: 'the provider rejected the request',
  invalid_provider_response: 'the provider returned a response we could not parse',
  empty_completion: 'the model returned no text (token budget too small for a reasoning model)',
  blocked_url: 'the provider URL resolves to a private or blocked address',
  host_not_allowed: 'the provider host is not allowlisted on this server',
  dns_failed: 'the provider hostname could not be resolved',
  network_error: 'the provider could not be reached',
  redirect_rejected: 'the provider redirected the request',
  missing_api_key: 'no API key was sent',
  missing_model: 'no model was configured',
  response_too_large: 'the provider response exceeded the size limit',
  request_too_large: 'the request exceeded the size limit',
  no_config_row: 'no AI settings have been saved yet',
  assistant_disabled: 'the AI assistant is switched off',
  unsupported_provider: 'the configured provider is not supported',
  encryption_unavailable: 'the server is missing AI_ASSISTANT_ENCRYPTION_KEY',
  api_key_undecryptable: 'the saved API key could not be decrypted; re-save it',
  request_timeout: 'the provider timed out',
  rate_limited: 'the provider rate limited the request',
};

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

/**
 * Builds the most specific message available. The backend returns a generic `message`
 * for end users plus machine-readable detail (`aiErrorCode`, `providerStatus`,
 * `providerMessage`) that is meaningless to surface on the public chat surface but is
 * exactly what an admin needs on the settings screen, so prefer it whenever present.
 */
export function getAiErrorMessage(error: unknown, options: { detailed?: boolean } = {}): string {
  if (!(error instanceof Error)) return 'AI assistant request failed';
  const body = (error as Error & { body?: Record<string, unknown> }).body;
  if (!body) return error.message;

  const code = firstString(body.aiErrorCode, body.reason);
  const providerStatus = typeof body.providerStatus === 'number' ? body.providerStatus : undefined;
  const providerMessage = firstString(body.providerMessage);
  const detail = firstString(body.detail);

  if (!options.detailed) {
    const hint = code ? AI_ERROR_CODE_HINTS[code] : undefined;
    return [error.message, hint].filter(Boolean).join(' — ');
  }

  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (code) parts.push(`code: ${code}${AI_ERROR_CODE_HINTS[code] ? ` (${AI_ERROR_CODE_HINTS[code]})` : ''}`);
  if (providerStatus !== undefined) parts.push(`provider HTTP: ${providerStatus}`);
  if (providerStatus === 401 || providerStatus === 403) parts.push('the stored API key was rejected');
  if (providerStatus === 404) parts.push('the base URL path is wrong — store only the base, e.g. https://api.deepseek.com');
  if (providerStatus === 429) parts.push('rate limited — wait and retry');
  if (providerMessage) parts.push(providerMessage);
  else if (detail) parts.push(detail);
  return parts.length > 0 ? parts.join(' · ') : error.message;
}

export function isAiAvailable(config: AiPublicConfig | null | undefined, authenticated = false): boolean {
  return !!config && config.enabled && (config.publicEnabled || authenticated) && config.status === 'ready';
}

function useAiTenantKey(): string {
  return useAuthStore((state) => state.user?.tenantId || 'default');
}

export function usePublicAiConfig(enabled = true) {
  const tenantKey = useAiTenantKey();
  return useQuery({
    queryKey: [...aiKeys.publicConfig(), tenantKey],
    queryFn: () => api.get<AiPublicConfig>('/ai/config'),
    enabled,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAiAdminStatus(enabled = true) {
  const tenantKey = useAiTenantKey();
  return useQuery({
    queryKey: [...aiKeys.adminStatus(), tenantKey],
    queryFn: () => api.get<AiAdminStatus>('/admin/ai/status'),
    enabled,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  const tenantKey = useAiTenantKey();
  const adminKey = [...aiKeys.adminStatus(), tenantKey] as const;
  const publicKey = [...aiKeys.publicConfig(), tenantKey] as const;
  return useMutation({
    mutationFn: (settings: AiSettingsUpdate) => api.put<AiMaskedSettings>('/admin/ai', settings),
    gcTime: 0,
    onSuccess: (saved) => {
      queryClient.setQueryData<AiAdminStatus>(adminKey, (current) =>
        current ? { ...current, ...saved } : current,
      );
      void queryClient.invalidateQueries({ queryKey: adminKey });
      void queryClient.invalidateQueries({ queryKey: publicKey });
    },
  });
}

export function useTestAiConnection() {
  const queryClient = useQueryClient();
  const tenantKey = useAiTenantKey();
  return useMutation({
    mutationFn: () => api.post<AiTestResponse>('/admin/ai/test'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.adminStatus(), tenantKey] });
    },
    // The backend records lastErrorCode / lastTestedAt on failure too, so refresh on
    // error as well. Without this the panel keeps showing the *previous* failure code,
    // which is actively misleading while diagnosing a provider problem.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.adminStatus(), tenantKey] });
    },
  });
}

export function useReindexAi() {
  const queryClient = useQueryClient();
  const tenantKey = useAiTenantKey();
  return useMutation({
    mutationFn: () => api.post<AiCorpusStats>('/admin/ai/reindex', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.adminStatus(), tenantKey] });
    },
  });
}

export function useAiChat(mode: 'public' | 'authenticated' = 'public') {
  const locale = coerceLocale(useLocale());
  return useMutation({
    mutationKey: ['ai-assistant', 'chat', mode],
    mutationFn: (input: AiChatRequest) => {
      const endpoint = mode === 'authenticated' ? '/ai/chat' : '/ai/public-chat';
      return api.post<AiChatResponse>(endpoint, buildChatPayload({ ...input, locale }));
    },
  });
}

export { buildChatPayload };

// ---------------------------------------------------------------------------
// Saved conversations
// ---------------------------------------------------------------------------

function useAiConversationKey(enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  // `enabled` is deliberately not part of the key: it changes while the auth store
  // hydrates, and baking it in threw away a loaded cache and refetched for nothing.
  void enabled;
  return [...aiKeys.conversations(), userId ?? 'anon', tenantId ?? 'tenant'] as const;
}

/** Paginated, searchable history for the signed-in member. */
export function useAiConversations(
  params: { status?: 'active' | 'archived'; search?: string; page?: number; limit?: number } = {},
  enabled = true,
) {
  const key = useAiConversationKey(enabled);
  // Filters belong in the key: without them a search term reuses the unfiltered
  // result and appears to do nothing.
  const queryKey = [...key, params.status ?? 'active', params.search ?? '', params.page ?? 1, params.limit ?? 30] as const;
  return useQuery({
    queryKey,
    enabled,
    queryFn: () => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      return api.get<{ data: AiConversationSummary[]; total: number; page: number; limit: number }>(
        `/ai/conversations?${query.toString()}`,
      );
    },
  });
}

/** One conversation with its transcript. */
export function useAiConversation(conversationId: string | null, enabled = true) {
  const key = useAiConversationKey(enabled);
  return useQuery({
    queryKey: [...key, conversationId ?? 'none'],
    enabled: enabled && !!conversationId,
    queryFn: () => api.get<AiConversation>(`/ai/conversations/${conversationId}`),
    retry: false,
  });
}

export function useRenameAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`/ai/conversations/${id}`, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.conversations()] });
    },
  });
}

export function useArchiveAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ai/conversations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.conversations()] });
    },
  });
}

// ---------------------------------------------------------------------------
// Feedback, web search settings and evals
// ---------------------------------------------------------------------------

/** Rate an answer. `0` withdraws a vote. */
export function useRateAiMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, rating, reason }: { messageId: string; rating: number; reason?: string }) =>
      api.post<{ rating: number }>(`/ai/messages/${messageId}/feedback`, { rating, reason }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.feedback(), variables.messageId] });
    },
  });
}

/** My votes on a conversation, so the thumbs render in the right state. */
export function useAiMessageFeedback(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.feedback(), conversationId ?? 'none'],
    enabled: enabled && !!conversationId,
    queryFn: () =>
      api.get<{ data: Array<{ messageId: string; rating: number }> }>(
        `/ai/conversations/${conversationId}/feedback`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAiWebSearchSettings(enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.webSearch()],
    enabled,
    queryFn: () => api.get<{ data: AiWebSearchSettings }>('/admin/ai/web-search'),
    retry: 1,
  });
}

export function useUpdateAiWebSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: AiWebSearchSettingsUpdate) =>
      api.put<{ data: { provider: string; enabled: boolean; hasApiKey: boolean; status: string } }>(
        '/admin/ai/web-search',
        settings,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.webSearch()] });
    },
  });
}

export function useTestAiWebSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ data: { ok: boolean; code?: string; resultCount?: number; provider: string } }>(
        '/admin/ai/web-search/test',
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.webSearch()] });
    },
  });
}

export function useAiFeedbackSummary(enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.feedbackSummary()],
    enabled,
    queryFn: () =>
      api.get<{
        data: {
          summary: AiFeedbackSummary;
          recent: Array<{
            messageId: string;
            rating: number;
            reason: string | null;
            mode: string | null;
            usedWeb: boolean;
            createdAt: string;
            content: string;
          }>;
        };
      }>('/admin/ai/feedback'),
  });
}

export function useAiEvalCases(enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.evalCases()],
    enabled,
    queryFn: () => api.get<{ data: AiEvalCase[] }>('/admin/ai/eval/cases'),
  });
}

export function useAiEvalRuns(enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.evalRuns()],
    enabled,
    queryFn: () => api.get<{ data: AiEvalRun[] }>('/admin/ai/eval/runs'),
  });
}

export function useRunAiEval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ label, limit }: { label: string; limit?: number }) =>
      api.post<{ data: AiEvalRun }>('/admin/ai/eval/runs', { label, limit }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.evalRuns()] });
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.evalCases()] });
    },
  });
}

export function useAiLearningSnapshot(enabled = true) {
  return useQuery({
    queryKey: [...aiKeys.learning()],
    enabled,
    queryFn: () => api.get<{ data: AiLearningSnapshot }>('/admin/ai/learning'),
  });
}
