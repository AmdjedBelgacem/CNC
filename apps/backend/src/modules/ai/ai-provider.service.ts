import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ConfigService } from '../../config/config.service';

export interface AiProviderCompletionInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel?: string | null;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface AiProviderCompletionResult {
  content: string;
  model: string;
  usedFallback: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiProviderEmbeddingInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  inputs: string[];
  timeoutMs: number;
}

export interface AiProviderErrorDetail {
  providerStatus?: number;
  providerMessage?: string;
}

export class AiProviderError extends Error {
  readonly providerStatus?: number;
  readonly providerMessage?: string;

  constructor(
    readonly code: string,
    readonly retryable = false,
    detail: AiProviderErrorDetail = {},
  ) {
    super('AI provider unavailable');
    this.name = 'AiProviderError';
    this.providerStatus = detail.providerStatus;
    this.providerMessage = detail.providerMessage;
  }
}

const PROVIDER_MESSAGE_MAX = 500;

/**
 * Turns an upstream error body into a short human-readable string.
 * Providers routinely echo credentials back inside error payloads, so redact before storing.
 */
function sanitizeProviderMessage(bodyText: string, apiKey: string): string | undefined {
  const raw = typeof bodyText === 'string' ? bodyText.trim() : '';
  if (!raw) return undefined;

  let text = raw;
  if (apiKey) text = text.split(apiKey).join('[redacted]');
  text = text
    .replace(/\bsk-[A-Za-z0-9_-]{4}[A-Za-z0-9_-]*/g, 'sk-...[redacted]')
    .replace(/"(authorization|api[_-]?key|token|secret)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]');

  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (parsed && typeof parsed === 'object') {
      const err =
        parsed.error && typeof parsed.error === 'object'
          ? (parsed.error as { message?: unknown; code?: unknown; type?: unknown })
          : (parsed as { message?: unknown; code?: unknown; type?: unknown });
      const parts = [
        typeof err.message === 'string' ? err.message : undefined,
        typeof err.code === 'string' ? `code=${err.code}` : undefined,
        typeof err.type === 'string' ? `type=${err.type}` : undefined,
      ].filter((part): part is string => Boolean(part));
      if (parts.length > 0) return parts.join(' | ').slice(0, PROVIDER_MESSAGE_MAX);
    }
  } catch {
    /* not JSON - fall through to the redacted raw text */
  }

  return text.slice(0, PROVIDER_MESSAGE_MAX);
}

@Injectable()
export class AiProviderService {
  constructor(private readonly config: ConfigService) {}

  validateBaseUrl(raw: string): URL {
    if (typeof raw !== 'string' || raw.length < 8 || raw.length > 500) {
      throw new AiProviderError('invalid_url');
    }
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      throw new AiProviderError('invalid_url');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new AiProviderError('invalid_url');
    }
    if (parsed.protocol === 'http:' && !this.allowPrivateHosts()) {
      throw new AiProviderError('invalid_url');
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new AiProviderError('invalid_url');
    }
    const host = this.normalizeHost(parsed.hostname);
    const allowPrivate = this.allowPrivateHosts();
    if (!host || this.isBlockedHostname(host) || isIP(host)) {
      if (!host || ((this.isBlockedHostname(host) || (isIP(host) && this.isPrivateAddress(host))) && !allowPrivate)) {
        throw new AiProviderError('blocked_url');
      }
    }
    const allowedHosts = this.allowedHosts();
    if (this.config.get('NODE_ENV') === 'production' && allowedHosts.length === 0) {
      throw new AiProviderError('blocked_url');
    }
    if (allowedHosts.length > 0 && !this.matchesAllowlist(host, allowedHosts)) {
      throw new AiProviderError('host_not_allowed');
    }
    return parsed;
  }

  async assertSafeUrl(raw: string): Promise<string> {
    const parsed = this.validateBaseUrl(raw);
    const host = this.normalizeHost(parsed.hostname);
    const allowPrivate = this.allowPrivateHosts();
    if (!this.isBlockedHostname(host) && !isIP(host)) {
      let addresses: Array<{ address: string }>;
      try {
        addresses = await lookup(host, { all: true, verbatim: true });
      } catch {
        throw new AiProviderError('dns_failed');
      }
      if (addresses.length === 0 || (!allowPrivate && addresses.some(({ address }) => this.isPrivateAddress(address)))) {
        throw new AiProviderError('blocked_url');
      }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
  }

  async complete(input: AiProviderCompletionInput): Promise<AiProviderCompletionResult> {
    const models = [input.model, input.fallbackModel].filter(
      (model, index, list): model is string => typeof model === 'string' && model.length > 0 && list.indexOf(model) === index,
    );
    if (models.length === 0) throw new AiProviderError('missing_model');
    let lastError: AiProviderError | null = null;
    for (let index = 0; index < models.length; index += 1) {
      const model = models[index]!;
      try {
        const result = await this.requestCompletionWithRetry(input, model);
        return { ...result, model, usedFallback: index > 0 };
      } catch (error) {
        lastError = error instanceof AiProviderError ? error : new AiProviderError('provider_error');
      }
    }
    throw lastError ?? new AiProviderError('provider_error');
  }

  /**
   * Reasoning/thinking models spend the token budget on `reasoning_content` and can
   * return `content: ""` with `finish_reason: "length"`. Retry once with a larger
   * budget so a tight max_tokens degrades into a slower answer rather than a 503.
   */
  private async requestCompletionWithRetry(
    input: AiProviderCompletionInput,
    model: string,
  ): Promise<Omit<AiProviderCompletionResult, 'model' | 'usedFallback'>> {
    const first = await this.requestCompletion(input, model).catch((error: unknown) => {
      const err = error instanceof AiProviderError ? error : new AiProviderError('provider_error');
      if (err.code !== 'empty_completion') throw err;
      return err;
    });
    if (!(first instanceof AiProviderError)) return first;
    if (!first.retryable) throw first;

    const raised = Math.min(Math.max(input.maxTokens * 4, 1024), 8000);
    if (raised === input.maxTokens) throw first;
    return this.requestCompletion({ ...input, maxTokens: raised }, model);
  }

  async embed(input: AiProviderEmbeddingInput): Promise<number[][]> {
    if (!input.model || input.inputs.length === 0 || input.inputs.length > 32) {
      throw new AiProviderError('invalid_embedding_request');
    }
    if (input.inputs.some((value) => typeof value !== 'string' || value.length > 8000 || value.length === 0)) {
      throw new AiProviderError('invalid_embedding_request');
    }
    const body = await this.requestJson(input.baseUrl, '/embeddings', {
      model: input.model,
      input: input.inputs,
    }, input.apiKey, input.timeoutMs);
    const data = body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: Array<{ index?: unknown; embedding?: unknown }> }).data
      : [];
    const vectors = new Array<number[] | null>(input.inputs.length).fill(null);
    for (const item of data) {
      if (!item || !Array.isArray(item.embedding) || item.embedding.length === 0 || item.embedding.length > 8192) continue;
      const index = Number.isInteger(item.index) ? Number(item.index) : data.indexOf(item);
      if (index < 0 || index >= vectors.length) continue;
      const vector = item.embedding.map((value) => Number(value));
      if (vector.every((value) => Number.isFinite(value))) vectors[index] = vector;
    }
    if (vectors.some((vector) => vector === null)) throw new AiProviderError('invalid_embedding_response');
    return vectors as number[][];
  }

  private async requestCompletion(input: AiProviderCompletionInput, model: string) {
    const body = await this.requestJson(input.baseUrl, '/chat/completions', {
      model,
      messages: input.messages,
      max_tokens: Math.min(Math.max(Math.floor(input.maxTokens), 1), 8000),
      temperature: Math.min(Math.max(Number(input.temperature), 0), 2),
      stream: false,
    }, input.apiKey, input.timeoutMs);
    const choices = body && typeof body === 'object' && Array.isArray((body as { choices?: unknown }).choices)
      ? (body as { choices: Array<{ message?: { content?: unknown; reasoning_content?: unknown }; finish_reason?: unknown }> }).choices
      : [];
    const rawContent = choices[0]?.message?.content;
    const content = this.normalizeContent(rawContent);
    if (!content) {
      const diagnosis = this.describeEmptyCompletion(choices, model);
      // finish_reason "length" means the budget ran out, not that the model is broken.
      const exhausted = choices[0]?.finish_reason === 'length';
      throw new AiProviderError(exhausted ? 'empty_completion' : 'invalid_provider_response', exhausted, {
        providerStatus: 200,
        providerMessage: diagnosis,
      });
    }
    const usage = body && typeof body === 'object' ? (body as { usage?: Record<string, unknown> }).usage : undefined;
    const inputTokens = this.safeNumber(usage?.prompt_tokens ?? usage?.input_tokens);
    const outputTokens = this.safeNumber(usage?.completion_tokens ?? usage?.output_tokens);
    const totalTokens = this.safeNumber(usage?.total_tokens) || inputTokens + outputTokens;
    return { content, inputTokens, outputTokens, totalTokens };
  }

  private async requestJson(
    baseUrl: string,
    endpoint: string,
    payload: Record<string, unknown>,
    apiKey: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 4096) {
      throw new AiProviderError('missing_api_key');
    }
    const normalizedBase = await this.assertSafeUrl(baseUrl);
    const endpointUrl = new URL(`${normalizedBase}${endpoint}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1000), 120000));
    let response: Response;
    let bodyText: string;
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length > 2_000_000) throw new AiProviderError('request_too_large');
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: serialized,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) throw new AiProviderError('redirect_rejected');
      bodyText = await this.readResponse(response);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('network_error', true);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new AiProviderError('http_error', response.status === 429 || response.status >= 500, {
        providerStatus: response.status,
        providerMessage: sanitizeProviderMessage(bodyText, apiKey),
      });
    }
    try {
      const parsed = JSON.parse(bodyText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      return parsed as Record<string, unknown>;
    } catch {
      throw new AiProviderError('invalid_provider_response');
    }
  }

  private async readResponse(response: Response): Promise<string> {
    const maxBytes = this.config.get('AI_PROVIDER_MAX_RESPONSE_BYTES') || 1_048_576;
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new AiProviderError('response_too_large');
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        if (next.value) {
          total += next.value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            throw new AiProviderError('response_too_large');
          }
          chunks.push(next.value);
        }
      }
    } finally {
      reader.releaseLock();
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  private normalizeContent(value: unknown): string {
    if (typeof value === 'string') return value.trim().slice(0, 20000);
    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        })
        .join('')
        .trim()
        .slice(0, 20000);
    }
    return '';
  }

  /**
   * Explains an empty `content` field. Reasoning/thinking models spend the whole
   * token budget on `reasoning_content` and return `content: ""` with
   * `finish_reason: "length"`, which is otherwise indistinguishable from a broken provider.
   */
  private describeEmptyCompletion(
    choices: Array<{ message?: { reasoning_content?: unknown }; finish_reason?: unknown }>,
    model: string,
  ): string {
    if (choices.length === 0) return 'provider returned no choices array';
    const choice = choices[0]!;
    const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : 'unknown';
    const reasoning = choice.message?.reasoning_content;
    const reasoningChars = typeof reasoning === 'string' ? reasoning.length : 0;
    if (reasoningChars > 0) {
      return `model "${model}" returned empty content after ${reasoningChars} reasoning chars (finish_reason=${finishReason}); it is a thinking model, so raise max_tokens or disable thinking mode`;
    }
    return `model "${model}" returned empty content (finish_reason=${finishReason})`;
  }

  private safeNumber(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  private allowPrivateHosts(): boolean {
    return this.config.get('NODE_ENV') !== 'production' && this.config.get('AI_PROVIDER_ALLOW_PRIVATE_HOSTS') === 'true';
  }

  private allowedHosts(): string[] {
    const raw = this.config.get('AI_PROVIDER_ALLOWED_HOSTS') || '';
    return raw
      .split(',')
      .map((value) => value.trim().toLowerCase().replace(/^\*\./, ''))
      .filter((value) => value && value !== '*')
      .map((value) => value.replace(/^https?:\/\//, '').split('/')[0]!.split(':')[0]!);
  }

  private matchesAllowlist(host: string, allowed: string[]): boolean {
    return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
  }

  private normalizeHost(host: string): string {
    return host.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  }

  private isBlockedHostname(host: string): boolean {
    return host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.intranet') ||
      host.endsWith('.lan') ||
      host.endsWith('.home') ||
      host.endsWith('.test') ||
      host.endsWith('.invalid') ||
      host === 'metadata.google.internal' ||
      host === 'instance-data' ||
      host === 'host.docker.internal';
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase();
    const version = isIP(normalized);
    if (version === 4) {
      const parts = normalized.split('.').map(Number);
      const a = parts[0]!;
      const b = parts[1]!;
      return a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51) ||
        (a === 203 && b === 0) ||
        a >= 224;
    }
    if (version === 6) {
      if (normalized === '::' || normalized === '::1') return true;
      if (/^f[cd]/.test(normalized) || /^fe[89abc]/.test(normalized) || /^ff/.test(normalized)) return true;
      if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0000:') || normalized.startsWith('2002:')) return true;
      const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this.isPrivateAddress(mapped[1]!);
      const mappedHex = normalized.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (mappedHex) {
        const high = Number.parseInt(mappedHex[1]!, 16);
        const low = Number.parseInt(mappedHex[2]!, 16);
        return this.isPrivateAddress([high >> 8, high & 255, low >> 8, low & 255].join('.'));
      }
      const compatibleHex = normalized.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (compatibleHex) {
        const high = Number.parseInt(compatibleHex[1]!, 16);
        const low = Number.parseInt(compatibleHex[2]!, 16);
        return this.isPrivateAddress([high >> 8, high & 255, low >> 8, low & 255].join('.'));
      }
      return false;
    }
    return true;
  }
}
