export type AiLocale = 'en' | 'ar';

export interface AiProviderRuntimeConfig {
  tenantId: string;
  provider: 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  fallbackModel: string | null;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  embeddingModel: string | null;
  embeddingBaseUrl: string | null;
}

export interface AiMaskedSettings {
  provider: 'openai-compatible';
  baseUrl: string;
  primaryModel: string;
  fallbackModel: string | null;
  enabled: boolean;
  publicEnabled: boolean;
  retrievalTopK: number;
  retrievalMinScore: number;
  maxContextChars: number;
  systemStyle: string | null;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  embeddingModel: string | null;
  embeddingBaseUrl: string | null;
  status: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  encryptionConfigured: boolean;
  lastTestedAt: Date | null;
  lastErrorCode: string | null;
  lastIndexedAt: Date | null;
  lastIndexDocuments: number;
  lastIndexChunks: number;
  lastIndexEmbeddedChunks: number;
  lastIndexError: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AiSettingsUpdate {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string | null;
  enabled?: boolean;
  publicEnabled?: boolean;
  retrievalTopK?: number;
  retrievalMinScore?: number;
  maxContextChars?: number;
  systemStyle?: string | null;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  embeddingModel?: string | null;
  embeddingBaseUrl?: string | null;
}

export interface AiDocumentInput {
  sourceType: string;
  sourceId: string;
  title: string;
  href: string;
  content: string;
  audience: 'public' | 'free-preview' | 'enrolled' | 'admin';
  courseId?: string | null;
  lessonId?: string | null;
  permissionMetadata?: Record<string, unknown>;
  sourceUpdatedAt?: Date;
}

export interface AiRetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  sourceType: string;
  sourceId: string;
  title: string;
  href: string;
  courseId: string | null;
  lessonId: string | null;
}

/**
 * Identifies the answer-affecting prompt generation.
 *
 * Stamped on every stored message and every eval run. Bump it whenever the
 * system prompt, mode instructions or web attribution rules change: it is the
 * only thing that makes "did that make it better?" answerable.
 */
export const AI_PROMPT_VERSION = 'v2-web';

export interface AiChatCitation {
  sourceType: string;
  sourceId: string;
  title: string;
  href: string;
}

export interface AiPageContext {
  courseId: string;
  lessonId: string;
}

export interface AiChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiViewer {
  id?: string;
  role?: string;
  tenantId?: string;
}

export interface AiProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
