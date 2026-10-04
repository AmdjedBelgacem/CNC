import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { aiWebSearchCache, aiWebSearchConfigs, type AiWebSearchProvider } from '../../database/schema/ai-learning';
import { AiSecretService } from './ai-secret.service';
import { sanitizeRetrievedText, sanitizeUserText } from './ai-safety.service';
import { AiProviderService } from './ai-provider.service';

export class AiWebSearchError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
  ) {
    super('Web search unavailable');
    this.name = 'AiWebSearchError';
  }
}

export interface AiWebResult {
  title: string;
  url: string;
  /** Host only, for display: `docs.example.com`. */
  site: string;
  snippet: string;
  publishedAt: string | null;
  provider: string;
  rank: number;
}

export interface AiWebSearchOutcome {
  results: AiWebResult[];
  /** True only when results were actually fetched or served from cache. */
  used: boolean;
  provider: AiWebSearchProvider | null;
  /** Machine-readable explanation when `used` is false. */
  reason?: string;
  fromCache?: boolean;
}

export interface AiWebSearchSettings {
  provider: AiWebSearchProvider;
  encryptedApiKey: string | null;
  enabled: boolean;
  maxResults: number;
  timeoutMs: number;
  allowedDomains: string[];
  allowedModes: string[];
  cacheTtlSeconds: number;
  status: string;
  lastErrorCode: string | null;
}

/** Fixed endpoints: the outbound host is never attacker-controlled. */
const ENDPOINTS: Record<Exclude<AiWebSearchProvider, 'none'>, string> = {
  brave: 'https://api.search.brave.com/res/v1/web/search',
  tavily: 'https://api.tavily.com/search',
  serper: 'https://google.serper.dev/search',
};

const MAX_QUERY_CHARS = 400;
const MAX_RESULTS_HARD_CAP = 10;
const MAX_SNIPPET_CHARS = 600;
const MAX_CACHE_PURGE_ROWS = 500;

@Injectable()
export class AiWebSearchService {
  private readonly logger = new Logger(AiWebSearchService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly secrets: AiSecretService,
    private readonly provider: AiProviderService,
  ) {}

  async getSettings(tenantId: string): Promise<AiWebSearchSettings> {
    const [row] = await this.drizzle.db
      .select()
      .from(aiWebSearchConfigs)
      .where(eq(aiWebSearchConfigs.tenantId, tenantId))
      .limit(1);
    if (!row) {
      return {
        provider: 'none',
        encryptedApiKey: null,
        enabled: false,
        maxResults: 5,
        timeoutMs: 8000,
        allowedDomains: [],
        allowedModes: ['fact_check'],
        cacheTtlSeconds: 3600,
        status: 'disabled',
        lastErrorCode: null,
      };
    }
    return {
      provider: row.provider,
      encryptedApiKey: row.encryptedApiKey,
      enabled: row.enabled,
      maxResults: row.maxResults,
      timeoutMs: row.timeoutMs,
      allowedDomains: Array.isArray(row.allowedDomains) ? row.allowedDomains : [],
      allowedModes: Array.isArray(row.allowedModes) ? row.allowedModes : ['fact_check'],
      cacheTtlSeconds: row.cacheTtlSeconds,
      status: row.status,
      lastErrorCode: row.lastErrorCode ?? null,
    };
  }

  /**
   * Persist admin settings. The credential is encrypted with the same envelope
   * and AAD scheme as the model provider key, bound to tenant and provider, so
   * switching search providers re-wraps rather than reusing a foreign key.
   */
  async updateSettings(
    tenantId: string,
    input: {
      provider: AiWebSearchProvider;
      apiKey?: string;
      clearApiKey?: boolean;
      enabled?: boolean;
      maxResults?: number;
      timeoutMs?: number;
      allowedDomains?: string[];
      allowedModes?: string[];
      cacheTtlSeconds?: number;
    },
  ): Promise<{ provider: AiWebSearchProvider; enabled: boolean; hasApiKey: boolean; status: string }> {
    const existing = await this.drizzle.db
      .select()
      .from(aiWebSearchConfigs)
      .where(eq(aiWebSearchConfigs.tenantId, tenantId))
      .limit(1);
    const previous = existing[0] ?? null;

    const provider = input.provider ?? previous?.provider ?? 'none';
    const domains = (input.allowedDomains ?? previous?.allowedDomains ?? []).map((entry) =>
      sanitizeUserText(String(entry), 120).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    ).filter((entry) => entry.length > 0 && entry.includes('.') && !entry.includes('/'));
    const modes = (input.allowedModes ?? previous?.allowedModes ?? ['fact_check']).filter((mode) =>
      ['general', 'fact_check', 'ask_post', 'ask_lesson'].includes(mode),
    );

    let encryptedApiKey = previous?.encryptedApiKey ?? null;
    if (input.clearApiKey === true) {
      encryptedApiKey = null;
    } else if (input.apiKey !== undefined && input.apiKey.trim() !== '') {
      if (!this.secrets.configured) throw new ServiceUnavailableException('AI encryption is not configured');
      const trimmed = input.apiKey.trim();
      if (trimmed.length < 8 || trimmed.length > 500) throw new BadRequestException('Search API key length is invalid');
      encryptedApiKey = this.secrets.encrypt(trimmed, tenantId, `web-search:${provider}`);
    } else if (encryptedApiKey && previous && previous.provider !== provider) {
      // Re-wrap: the AAD binds the ciphertext to its provider name.
      if (!this.secrets.configured) throw new ServiceUnavailableException('AI encryption is not configured');
      const plaintext = this.secrets.decrypt(encryptedApiKey, tenantId, `web-search:${previous.provider}`);
      encryptedApiKey = this.secrets.encrypt(plaintext, tenantId, `web-search:${provider}`);
    }

    const enabled = (input.enabled ?? previous?.enabled ?? false) && provider !== 'none' && Boolean(encryptedApiKey);
    if ((input.enabled === true) && !encryptedApiKey) {
      throw new BadRequestException('A search API key is required before enabling web search');
    }

    const values = {
      tenantId,
      provider,
      encryptedApiKey,
      apiKeyVersion: 1,
      enabled,
      maxResults: Math.min(Math.max(Number(input.maxResults ?? previous?.maxResults ?? 5), 1), MAX_RESULTS_HARD_CAP),
      timeoutMs: Math.min(Math.max(Number(input.timeoutMs ?? previous?.timeoutMs ?? 8000), 1000), 30000),
      allowedDomains: domains,
      allowedModes: modes.length ? modes : ['fact_check'],
      cacheTtlSeconds: Math.min(Math.max(Number(input.cacheTtlSeconds ?? previous?.cacheTtlSeconds ?? 3600), 60), 86400),
      status: enabled ? 'ready' : 'disabled',
      lastErrorCode: null,
    };

    await this.drizzle.db
      .insert(aiWebSearchConfigs)
      .values(values)
      .onConflictDoUpdate({ target: aiWebSearchConfigs.tenantId, set: values });

    return { provider, enabled, hasApiKey: Boolean(encryptedApiKey), status: values.status };
  }

  async isEnabledFor(tenantId: string, mode: string): Promise<boolean> {
    const settings = await this.getSettings(tenantId);
    return settings.enabled && settings.provider !== 'none' && settings.allowedModes.includes(mode);
  }

  /** Admin view: never returns the key itself, only whether one is stored. */
  async getMaskedSettings(tenantId: string): Promise<{
    provider: AiWebSearchProvider;
    enabled: boolean;
    hasApiKey: boolean;
    apiKeyConfigured: boolean;
    maxResults: number;
    timeoutMs: number;
    allowedDomains: string[];
    allowedModes: string[];
    cacheTtlSeconds: number;
    status: string;
    lastTestedAt: Date | null;
    lastErrorCode: string | null;
  }> {
    const settings = await this.getSettings(tenantId);
    const [row] = await this.drizzle.db
      .select({ lastTestedAt: aiWebSearchConfigs.lastTestedAt })
      .from(aiWebSearchConfigs)
      .where(eq(aiWebSearchConfigs.tenantId, tenantId))
      .limit(1);
    return {
      provider: settings.provider,
      enabled: settings.enabled,
      hasApiKey: Boolean(settings.encryptedApiKey),
      apiKeyConfigured: Boolean(settings.encryptedApiKey),
      maxResults: settings.maxResults,
      timeoutMs: settings.timeoutMs,
      allowedDomains: settings.allowedDomains,
      allowedModes: settings.allowedModes,
      cacheTtlSeconds: settings.cacheTtlSeconds,
      status: settings.status,
      lastTestedAt: row?.lastTestedAt ?? null,
      lastErrorCode: settings.lastErrorCode,
    };
  }

  /**
   * Search the public web for a query.
   *
   * Fails closed: any missing credential, blocked host, timeout or malformed
   * payload returns zero results and a reason. The caller is expected to tell the
   * member that external evidence was unavailable rather than answer from the
   * model's memory.
   */
  async search(tenantId: string, query: string, mode: string): Promise<AiWebSearchOutcome> {
    const normalized = this.normalizeQuery(query);
    if (!normalized) return { results: [], used: false, provider: null, reason: 'empty_query' };

    const settings = await this.getSettings(tenantId);
    if (!settings.enabled || settings.provider === 'none') {
      return { results: [], used: false, provider: settings.provider, reason: 'disabled' };
    }
    if (!settings.allowedModes.includes(mode)) {
      return { results: [], used: false, provider: settings.provider, reason: 'mode_not_allowed' };
    }
    if (!settings.encryptedApiKey) {
      return { results: [], used: false, provider: settings.provider, reason: 'missing_api_key' };
    }
    if (!this.secrets.configured) {
      return { results: [], used: false, provider: settings.provider, reason: 'encryption_unavailable' };
    }

    const limit = Math.min(Math.max(Number(settings.maxResults) || 5, 1), MAX_RESULTS_HARD_CAP);
    const cacheHash = this.hashQuery(settings.provider, normalized, settings.allowedDomains, limit);

    const cached = await this.readCache(tenantId, settings.provider, cacheHash);
    if (cached) {
      return {
        results: this.filterResults(cached, settings.allowedDomains).slice(0, limit),
        used: true,
        provider: settings.provider,
        fromCache: true,
      };
    }

    let apiKey: string;
    try {
      apiKey = this.secrets.decrypt(settings.encryptedApiKey, tenantId, `web-search:${settings.provider}`);
    } catch {
      return { results: [], used: false, provider: settings.provider, reason: 'decrypt_failed' };
    }

    let raw: unknown;
    try {
      raw = await this.callProvider(settings.provider, apiKey, normalized, limit, settings.timeoutMs);
    } catch (error) {
      const code = error instanceof AiWebSearchError ? error.code : 'network_error';
      await this.recordFailure(tenantId, code);
      this.logger.warn(`Web search failed for tenant ${tenantId}: ${code}`);
      return { results: [], used: false, provider: settings.provider, reason: code };
    }

    const results = this.normalizeResults(raw, settings.provider, settings.allowedDomains, limit);
    await this.writeCache(tenantId, settings.provider, cacheHash, normalized, results, settings.cacheTtlSeconds);
    return { results, used: results.length > 0, provider: settings.provider, reason: results.length ? undefined : 'no_results' };
  }

  /** Admin "test connection": exercises the credential without touching the cache. */
  async testConnection(tenantId: string): Promise<{ ok: boolean; code?: string; resultCount?: number; provider: string }> {
    const settings = await this.getSettings(tenantId);
    if (settings.provider === 'none') return { ok: false, code: 'not_configured', provider: 'none' };
    if (!settings.encryptedApiKey) return { ok: false, code: 'missing_api_key', provider: settings.provider };
    if (!this.secrets.configured) return { ok: false, code: 'encryption_unavailable', provider: settings.provider };
    let apiKey: string;
    try {
      apiKey = this.secrets.decrypt(settings.encryptedApiKey, tenantId, `web-search:${settings.provider}`);
    } catch {
      return { ok: false, code: 'decrypt_failed', provider: settings.provider };
    }
    try {
      const raw = await this.callProvider(settings.provider, apiKey, 'TITANS manufacturing', 3, settings.timeoutMs);
      const results = this.normalizeResults(raw, settings.provider, settings.allowedDomains, 3);
      await this.markTested(tenantId, results.length ? null : 'no_results');
      return { ok: true, resultCount: results.length, provider: settings.provider };
    } catch (error) {
      const code = error instanceof AiWebSearchError ? error.code : 'network_error';
      await this.markTested(tenantId, code);
      return { ok: false, code, provider: settings.provider };
    }
  }

  async purgeExpired(tenantId: string): Promise<number> {
    const deleted = await this.drizzle.db
      .delete(aiWebSearchCache)
      .where(and(eq(aiWebSearchCache.tenantId, tenantId), sql`${aiWebSearchCache.expiresAt} < now()`))
      .returning({ id: aiWebSearchCache.id });
    return deleted.length;
  }

  // -------------------------------------------------------------------------
  // Provider adapters
  // -------------------------------------------------------------------------

  private async callProvider(
    provider: Exclude<AiWebSearchProvider, 'none'>,
    apiKey: string,
    query: string,
    limit: number,
    timeoutMs: number,
  ): Promise<unknown> {
    const endpoint = ENDPOINTS[provider];
    // Same DNS/private-address gate the LLM provider uses: a rebinding or
    // misconfigured endpoint must not turn search into an internal request.
    const safeUrl = await this.provider.assertSafeUrl(endpoint);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(Math.max(Number(timeoutMs) || 8000, 1000), 30000),
    );
    try {
      let response: Response;
      if (provider === 'brave') {
        const url = new URL(safeUrl);
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(limit));
        response = await fetch(url, {
          headers: { accept: 'application/json', 'x-subscription-token': apiKey },
          signal: controller.signal,
          redirect: 'manual',
        });
      } else if (provider === 'tavily') {
        response = await fetch(safeUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ api_key: apiKey, query, max_results: limit, include_answer: false }),
          signal: controller.signal,
          redirect: 'manual',
        });
      } else {
        response = await fetch(safeUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ q: query, num: limit }),
          signal: controller.signal,
          redirect: 'manual',
        });
      }
      if (response.status >= 300 && response.status < 400) throw new AiWebSearchError('redirect_rejected');
      // Verified against the live APIs: Tavily answers 401, Brave answers 422
      // with SUBSCRIPTION_TOKEN_INVALID. All of these mean "credential rejected".
      if ([400, 401, 403, 422].includes(response.status)) {
        throw new AiWebSearchError('invalid_api_key');
      }
      if (response.status === 429) throw new AiWebSearchError('rate_limited', true);
      if (!response.ok) throw new AiWebSearchError('provider_error', response.status >= 500);
      const text = await response.text();
      if (text.length > 1_000_000) throw new AiWebSearchError('response_too_large');
      try {
        return JSON.parse(text);
      } catch {
        throw new AiWebSearchError('invalid_provider_response');
      }
    } catch (error) {
      if (error instanceof AiWebSearchError) throw error;
      if ((error as { name?: string })?.name === 'AbortError') throw new AiWebSearchError('timeout', true);
      throw new AiWebSearchError('network_error', true);
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeResults(
    raw: unknown,
    provider: string,
    allowedDomains: string[],
    limit: number,
  ): AiWebResult[] {
    const rows = this.extractRows(raw, provider);
    const out: AiWebResult[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const url = this.safeResultUrl(row.url);
      if (!url) continue;
      if (!this.domainAllowed(url, allowedDomains)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      const snippet = sanitizeRetrievedText(this.stripHtml(row.snippet), MAX_SNIPPET_CHARS);
      out.push({
        title: sanitizeRetrievedText(this.stripHtml(row.title), 200) || url,
        url,
        site: new URL(url).hostname.replace(/^www\./, ''),
        snippet,
        publishedAt: this.normalizeDate(row.publishedAt),
        provider,
        rank: out.length + 1,
      });
      if (out.length >= Math.min(limit, MAX_RESULTS_HARD_CAP)) break;
    }
    return out;
  }

  private extractRows(raw: unknown, provider: string): Array<{ title: unknown; url: unknown; snippet: unknown; publishedAt?: unknown }> {
    const body = (raw ?? {}) as Record<string, unknown>;
    let candidates: unknown[] = [];
    if (provider === 'brave') {
      const web = (body.web as { results?: unknown } | undefined)?.results;
      candidates = Array.isArray(web) ? web : [];
    } else if (provider === 'tavily') {
      candidates = Array.isArray(body.results) ? body.results : [];
    } else {
      candidates = Array.isArray(body.organic) ? body.organic : [];
    }
    return candidates
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => ({
        title: row.title,
        url: row.url ?? row.link,
        snippet: row.description ?? row.snippet ?? row.content,
        publishedAt: row.page_age ?? row.published_date ?? row.date,
      }));
  }

  /** Only http(s), and never a link into the tenant's own infrastructure. */
  private safeResultUrl(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 2000) return null;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
    return parsed.toString();
  }

  private domainAllowed(url: string, allowedDomains: string[]): boolean {
    if (!allowedDomains.length) return true;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return allowedDomains.some((entry) => {
      const domain = String(entry).trim().toLowerCase().replace(/^www\./, '');
      if (!domain) return false;
      return host === domain || host.endsWith(`.${domain}`);
    });
  }

  private filterResults(results: AiWebResult[], allowedDomains: string[]): AiWebResult[] {
    return results.filter((row) => this.domainAllowed(row.url, allowedDomains));
  }

  private stripHtml(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 40) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private normalizeQuery(query: string): string {
    return String(query ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_QUERY_CHARS);
  }

  private hashQuery(provider: string, query: string, allowedDomains: string[], limit: number): string {
    return createHash('sha256')
      .update([provider, query.toLowerCase(), [...allowedDomains].sort().join(','), String(limit)].join('|'))
      .digest('hex');
  }

  // -------------------------------------------------------------------------
  // Cache + status
  // -------------------------------------------------------------------------

  private async readCache(tenantId: string, provider: string, hash: string): Promise<AiWebResult[] | null> {
    const [row] = await this.drizzle.db
      .select({ results: aiWebSearchCache.results })
      .from(aiWebSearchCache)
      .where(
        and(
          eq(aiWebSearchCache.tenantId, tenantId),
          eq(aiWebSearchCache.provider, provider),
          eq(aiWebSearchCache.queryHash, hash),
          gt(aiWebSearchCache.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ? (row.results as AiWebResult[]) : null;
  }

  private async writeCache(
    tenantId: string,
    provider: string,
    hash: string,
    query: string,
    results: AiWebResult[],
    ttlSeconds: number,
  ): Promise<void> {
    const ttl = Math.min(Math.max(Number(ttlSeconds) || 3600, 60), 86400);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.drizzle.db
      .insert(aiWebSearchCache)
      .values({
        tenantId,
        provider,
        queryHash: hash,
        query,
        results,
        resultCount: results.length,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [aiWebSearchCache.tenantId, aiWebSearchCache.provider, aiWebSearchCache.queryHash],
        set: { results, resultCount: results.length, expiresAt },
      });
    // Opportunistic bounded cleanup; never unbounded.
    await this.drizzle.db.execute(
      sql`delete from ${aiWebSearchCache}
          where ${aiWebSearchCache.tenantId} = ${tenantId}
            and ${aiWebSearchCache.expiresAt} < now()
            and ${aiWebSearchCache.id} in (
              select id from ${aiWebSearchCache}
              where ${aiWebSearchCache.tenantId} = ${tenantId} and ${aiWebSearchCache.expiresAt} < now()
              limit ${MAX_CACHE_PURGE_ROWS}
            )`,
    );
  }

  private async recordFailure(tenantId: string, code: string): Promise<void> {
    await this.drizzle.db
      .insert(aiWebSearchConfigs)
      .values({ tenantId, provider: 'none', lastErrorCode: code, status: 'degraded' })
      .onConflictDoUpdate({
        target: aiWebSearchConfigs.tenantId,
        set: { lastErrorCode: code, status: 'degraded' },
      })
      .catch(() => undefined);
  }

  private async markTested(tenantId: string, errorCode: string | null): Promise<void> {
    await this.drizzle.db
      .insert(aiWebSearchConfigs)
      .values({
        tenantId,
        provider: 'none',
        lastTestedAt: new Date(),
        lastErrorCode: errorCode,
        status: errorCode ? 'degraded' : 'ready',
      })
      .onConflictDoUpdate({
        target: aiWebSearchConfigs.tenantId,
        set: { lastTestedAt: new Date(), lastErrorCode: errorCode, status: errorCode ? 'degraded' : 'ready' },
      })
      .catch(() => undefined);
  }
}
