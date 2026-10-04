import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { tenants } from '../../database/schema/tenants';
import { DrizzleService } from '../../database/drizzle.service';
import { aiProviderConfigs } from '../../database/schema/ai';
import { ConfigService } from '../../config/config.service';
import { AiAuditService, type AiAuditContext } from './ai-audit.service';
import { AiProviderError, AiProviderService } from './ai-provider.service';
import { AiSecretService } from './ai-secret.service';
import { sanitizeUserText } from './ai-safety.service';
import type { AiMaskedSettings, AiProviderRuntimeConfig, AiSettingsUpdate } from './ai.types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Reasoning models (DeepSeek, o-series, QwQ…) emit `reasoning_content` before the
 * answer and share one budget across both. A very small max_tokens yields an empty
 * completion, so the floor leaves room for reasoning plus a usable reply.
 */
const MIN_MAX_TOKENS = 256;

/**
 * Endpoint paths callers habitually paste into the "base URL" field. The client
 * appends the endpoint itself, so leaving one in place produces a doubled path
 * that 404s at request time instead of failing fast on save.
 */
const PROVIDER_ENDPOINT_SUFFIXES = [
  '/chat/completions',
  '/completions',
  '/embeddings',
  '/responses',
  '/messages',
  '/models',
];

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly secrets: AiSecretService,
    private readonly provider: AiProviderService,
    private readonly config: ConfigService,
    private readonly audit: AiAuditService,
  ) {}

  async getMaskedSettings(tenantId: string): Promise<AiMaskedSettings> {
    const row = await this.find(tenantId);
    return this.toMasked(row);
  }

  async getPublicStatus(tenantId: string): Promise<{ enabled: boolean; publicEnabled: boolean; status: string }> {
    const tenant = await this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Tenant not found');
    const settings = await this.getMaskedSettings(tenantId);
    return { enabled: settings.enabled, publicEnabled: settings.publicEnabled, status: settings.status };
  }

  async update(
    tenantId: string,
    input: AiSettingsUpdate,
    context: AiAuditContext = {},
  ): Promise<AiMaskedSettings> {
    const tenant = await this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Tenant not found or inactive');
    const existing = await this.find(tenantId);
    const provider = this.normalizeProvider(input.provider ?? existing?.provider ?? 'openai-compatible');
    const baseUrl = await this.validateUrl(input.baseUrl ?? existing?.baseUrl ?? DEFAULT_BASE_URL);
    const embeddingBaseUrl = input.embeddingBaseUrl === null
      ? null
      : input.embeddingBaseUrl === undefined
        ? existing?.embeddingBaseUrl || null
        : await this.validateUrl(input.embeddingBaseUrl);
    const primaryModel = this.cleanModel(input.primaryModel ?? existing?.primaryModel ?? DEFAULT_MODEL, 'primary model');
    const fallbackModel = this.cleanOptionalModel(input.fallbackModel === undefined ? existing?.fallbackModel : input.fallbackModel);
    const embeddingModel = this.cleanOptionalModel(input.embeddingModel === undefined ? existing?.embeddingModel : input.embeddingModel);
    const enabled = input.enabled ?? existing?.enabled ?? false;
    const publicEnabled = enabled && (input.publicEnabled ?? existing?.publicEnabled ?? false);
    const retrievalTopK = this.integerValue(input.retrievalTopK, existing?.retrievalTopK, 8, 1, 50, 'retrievalTopK');
    const retrievalMinScore = this.numberValue(input.retrievalMinScore, existing?.retrievalMinScore, 0.2, 0, 1, 'retrievalMinScore');
    const maxContextChars = this.integerValue(input.maxContextChars, existing?.maxContextChars, 12000, 1000, 100000, 'maxContextChars');
    const timeoutMs = this.integerValue(input.timeoutMs, existing?.timeoutMs, this.config.get('AI_PROVIDER_TIMEOUT_MS'), 1000, 120000, 'timeoutMs');
    const maxTokens = this.integerValue(input.maxTokens, existing?.maxTokens, 800, MIN_MAX_TOKENS, 8000, 'maxTokens');
    const temperature = this.numberValue(input.temperature, existing?.temperature, 0.2, 0, 2, 'temperature');
    const systemStyle = input.systemStyle === null
      ? null
      : input.systemStyle === undefined
        ? existing?.systemStyle || null
        : sanitizeUserText(input.systemStyle, 2000) || null;

    let encryptedApiKey = existing?.encryptedApiKey || null;
    if (input.apiKey !== undefined) {
      if (input.apiKey.trim() === '') {
        encryptedApiKey = null;
      } else {
        const apiKey = this.cleanApiKey(input.apiKey);
        if (!this.secrets.configured) throw new ServiceUnavailableException('AI encryption is not configured');
        encryptedApiKey = this.secrets.encrypt(apiKey, tenantId, provider);
      }
    } else if (encryptedApiKey && provider !== existing?.provider) {
      if (!this.secrets.configured) throw new ServiceUnavailableException('AI encryption is not configured');
      const plaintext = this.secrets.decrypt(encryptedApiKey, tenantId, existing!.provider);
      encryptedApiKey = this.secrets.encrypt(plaintext, tenantId, provider);
    }

    if (enabled && !encryptedApiKey) throw new BadRequestException('An API key is required before enabling the assistant');
    const status = this.deriveStatus(enabled, encryptedApiKey, provider, primaryModel);
    const now = new Date();
    const values = {
      tenantId,
      provider,
      baseUrl,
      encryptedApiKey,
      apiKeyVersion: 1,
      primaryModel,
      fallbackModel,
      enabled,
      publicEnabled,
      retrievalTopK,
      retrievalMinScore,
      maxContextChars,
      systemStyle,
      timeoutMs,
      maxTokens,
      temperature,
      embeddingModel,
      embeddingBaseUrl,
      status,
      lastErrorCode: null,
      updatedAt: now,
    } as const;
    await this.drizzle.db
      .insert(aiProviderConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: aiProviderConfigs.tenantId,
        set: values,
      });
    await this.audit.event(tenantId, 'ai.settings.update', 'success', context, 'ai_provider_config', tenantId, {
      provider,
      enabled,
      publicEnabled,
      primaryModel,
      fallbackModel,
      hasApiKey: !!encryptedApiKey,
    });
    return this.getMaskedSettings(tenantId);
  }

  async getRuntimeConfig(tenantId: string, options: { requireEnabled?: boolean } = {}): Promise<AiProviderRuntimeConfig> {
    const row = await this.find(tenantId);
    if (!row) throw this.unavailable('no_config_row', 'no AI configuration has been saved for this tenant');
    if (options.requireEnabled !== false && !row.enabled) {
      throw this.unavailable('assistant_disabled', 'AI assistant is switched off in settings');
    }
    if (row.provider !== 'openai-compatible') {
      throw this.unavailable('unsupported_provider', `provider "${row.provider}" is not supported`);
    }
    if (!this.secrets.configured) {
      throw this.unavailable('encryption_unavailable', 'server is missing AI_ASSISTANT_ENCRYPTION_KEY');
    }
    if (!row.encryptedApiKey) {
      throw this.unavailable('missing_api_key', 'no API key has been saved for this tenant');
    }
    let apiKey: string;
    try {
      apiKey = this.secrets.decrypt(row.encryptedApiKey, tenantId, row.provider);
    } catch {
      throw this.unavailable(
        'api_key_undecryptable',
        'the saved API key could not be decrypted; re-save it so it is re-encrypted with the current server key',
      );
    }
    return {
      tenantId,
      provider: 'openai-compatible',
      baseUrl: row.baseUrl,
      apiKey,
      primaryModel: row.primaryModel,
      fallbackModel: row.fallbackModel,
      timeoutMs: row.timeoutMs,
      maxTokens: row.maxTokens,
      temperature: row.temperature,
      embeddingModel: row.embeddingModel,
      embeddingBaseUrl: row.embeddingBaseUrl,
    };
  }

  private unavailable(reason: string, detail: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'AI assistant is unavailable',
      reason,
      detail,
    });
  }

  async recordIndexResult(
    tenantId: string,
    stats: { documents: number; chunks: number; embeddedChunks: number },
    error?: string,
  ): Promise<void> {
    await this.drizzle.db
      .update(aiProviderConfigs)
      .set({
        lastIndexedAt: new Date(),
        lastIndexDocuments: Math.max(0, Math.floor(stats.documents)),
        lastIndexChunks: Math.max(0, Math.floor(stats.chunks)),
        lastIndexEmbeddedChunks: Math.max(0, Math.floor(stats.embeddedChunks)),
        lastIndexError: error ? error.slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderConfigs.tenantId, tenantId));
  }

  async markTestResult(tenantId: string, success: boolean, errorCode?: string): Promise<void> {
    await this.drizzle.db
      .update(aiProviderConfigs)
      .set({
        lastTestedAt: new Date(),
        lastErrorCode: success ? null : (errorCode || 'provider_error').slice(0, 80),
        status: success ? 'ready' : 'error',
        updatedAt: new Date(),
      })
      .where(eq(aiProviderConfigs.tenantId, tenantId));
  }

  private async find(tenantId: string) {
    return this.drizzle.db.query.aiProviderConfigs.findFirst({
      where: eq(aiProviderConfigs.tenantId, tenantId),
    });
  }

  private toMasked(row: typeof aiProviderConfigs.$inferSelect | undefined): AiMaskedSettings {
    const enabled = row?.enabled ?? false;
    const encryptedApiKey = row?.encryptedApiKey || null;
    let apiKeyReadable = false;
    if (encryptedApiKey && this.secrets.configured && row) {
      try {
        this.secrets.decrypt(encryptedApiKey, row.tenantId, row.provider);
        apiKeyReadable = true;
      } catch {
        apiKeyReadable = false;
      }
    }
    return {
      provider: 'openai-compatible',
      baseUrl: row?.baseUrl || DEFAULT_BASE_URL,
      primaryModel: row?.primaryModel || DEFAULT_MODEL,
      fallbackModel: row?.fallbackModel || null,
      enabled,
      publicEnabled: row?.publicEnabled ?? false,
      retrievalTopK: row?.retrievalTopK ?? 8,
      retrievalMinScore: row?.retrievalMinScore ?? 0.2,
      maxContextChars: row?.maxContextChars ?? 12000,
      systemStyle: row?.systemStyle || null,
      timeoutMs: row?.timeoutMs ?? this.config.get('AI_PROVIDER_TIMEOUT_MS'),
      maxTokens: row?.maxTokens ?? 800,
      temperature: row?.temperature ?? 0.2,
      embeddingModel: row?.embeddingModel || null,
      embeddingBaseUrl: row?.embeddingBaseUrl || null,
      status: row?.status === 'error'
        ? 'error'
        : this.deriveStatus(enabled, apiKeyReadable ? encryptedApiKey : null, row?.provider || 'openai-compatible', row?.primaryModel || DEFAULT_MODEL),
      apiKeyConfigured: apiKeyReadable,
      apiKeyMasked: apiKeyReadable ? '********' : null,
      encryptionConfigured: this.secrets.configured,
      lastTestedAt: row?.lastTestedAt || null,
      lastErrorCode: row?.lastErrorCode || null,
      lastIndexedAt: row?.lastIndexedAt || null,
      lastIndexDocuments: row?.lastIndexDocuments ?? 0,
      lastIndexChunks: row?.lastIndexChunks ?? 0,
      lastIndexEmbeddedChunks: row?.lastIndexEmbeddedChunks ?? 0,
      lastIndexError: row?.lastIndexError || null,
      createdAt: row?.createdAt || null,
      updatedAt: row?.updatedAt || null,
    };
  }

  private deriveStatus(enabled: boolean, encryptedApiKey: string | null, provider: string, model: string): string {
    if (!enabled) return 'disabled';
    if (!this.secrets.configured) return 'encryption_unavailable';
    if (!encryptedApiKey || !model || provider !== 'openai-compatible') return 'incomplete';
    return 'ready';
  }

  private toProviderBaseUrl(value: string): string {
    let candidate = String(value ?? '').trim().replace(/\s+/g, '');
    if (!candidate) return candidate;

    // Collapse duplicate slashes in the path without touching the "https://" prefix.
    candidate = candidate.replace(/^(https?:\/\/)(.+)$/i, (_match, scheme: string, rest: string) =>
      `${scheme}${rest.replace(/\/{2,}/g, '/')}`,
    );
    candidate = candidate.replace(/\/+$/, '');

    const lowered = candidate.toLowerCase();
    const suffix = PROVIDER_ENDPOINT_SUFFIXES.find((end) => lowered.endsWith(end));
    if (suffix && candidate.length > suffix.length) {
      candidate = candidate.slice(0, candidate.length - suffix.length).replace(/\/+$/, '');
    }
    return candidate;
  }

  private async validateUrl(value: string): Promise<string> {
    const normalized = this.toProviderBaseUrl(value);
    try {
      return await this.provider.assertSafeUrl(normalized);
    } catch (error) {
      if (error instanceof AiProviderError) {
        if (error.code === 'host_not_allowed') {
          throw new BadRequestException('Provider host is not allowlisted');
        }
        throw new BadRequestException('Invalid provider URL');
      }
      throw new BadRequestException('Invalid provider URL');
    }
  }

  private normalizeProvider(value: string): 'openai-compatible' {
    const normalized = value.trim().toLowerCase().replace(/_/g, '-');
    if (normalized === 'openai' || normalized === 'openai-compatible') return 'openai-compatible';
    throw new BadRequestException('Unsupported AI provider');
  }

  private cleanApiKey(value: string): string {
    if (typeof value !== 'string') throw new BadRequestException('Invalid API key');
    const trimmed = value.trim();
    if (trimmed.length < 8 || trimmed.length > 4096 || /[\r\n]/.test(trimmed)) {
      throw new BadRequestException('Invalid API key');
    }
    return trimmed;
  }

  private cleanModel(value: string, label: string): string {
    if (typeof value !== 'string') throw new BadRequestException(`Invalid ${label}`);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 200 || /[\r\n]/.test(trimmed)) throw new BadRequestException(`Invalid ${label}`);
    return trimmed;
  }

  private cleanOptionalModel(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    return this.cleanModel(value, 'model');
  }

  private integerValue(
    input: number | undefined,
    existing: number | null | undefined,
    fallback: number,
    min: number,
    max: number,
    label: string,
  ): number {
    const value = input ?? existing ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) throw new BadRequestException(`Invalid ${label}`);
    return value;
  }

  private numberValue(
    input: number | undefined,
    existing: number | null | undefined,
    fallback: number,
    min: number,
    max: number,
    label: string,
  ): number {
    const value = input ?? existing ?? fallback;
    if (!Number.isFinite(value) || value < min || value > max) throw new BadRequestException(`Invalid ${label}`);
    return value;
  }
}
