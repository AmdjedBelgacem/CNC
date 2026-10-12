import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderService, AiProviderError } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import type { ContentLocale } from '@titan/shared';

/**
 * English → Arabic translation for authored content, using the tenant's own configured AI
 * provider.
 *
 * Every translatable entity — academies, courses, products — stores a `translations` JSON column
 * keyed by locale. Filling it by hand is the slowest part of publishing in two languages, and
 * until now there was no way to seed it from what already exists.
 *
 * This runs through the same `AiProviderService` the assistant uses, so it inherits the saved
 * provider, the allowlisted base URL, the encrypted key handling and the fallback model. Nothing
 * is hard-coded to a particular vendor.
 */
export interface TranslateFieldsInput {
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
  /** Field label → source text. Only non-empty strings are sent. */
  fields: Record<string, unknown>;
  /** Free-text hint describing what these fields are, e.g. "course description". */
  entity?: string;
}

export interface TranslateFieldsResult {
  targetLocale: ContentLocale;
  /** Field label → translated text, in the same key order as the request. */
  translations: Record<string, string>;
  model: string;
  usedFallback: boolean;
}

/**
 * Per-request field cap.
 *
 * Kept modest on purpose: one request maps to one model call, and a very large payload raises the
 * chance of a truncated or unparseable reply. Bulk callers go through `translateGroups`, which
 * splits work into batches of this size.
 */
const MAX_FIELDS = 40;
const MAX_FIELD_CHARS = 8000;

@Injectable()
export class AiTranslationService {
  private readonly logger = new Logger(AiTranslationService.name);

  constructor(
    private readonly provider: AiProviderService,
    private readonly settings: AiSettingsService,
  ) {}

  async translateFields(tenantId: string, input: TranslateFieldsInput): Promise<TranslateFieldsResult> {
    const sourceLocale = input.sourceLocale;
    const targetLocale = input.targetLocale;
    if (sourceLocale !== 'en') {
      throw new BadRequestException('Only English can be used as the translation source');
    }
    if (targetLocale !== 'ar') {
      throw new BadRequestException('Only Arabic is supported as a translation target');
    }

    const raw = Object.entries(input.fields ?? {});
    // Reject before filtering, so a nested object is named rather than silently dropped.
    for (const [key, value] of raw) {
      if (typeof value !== 'string') {
        throw new BadRequestException(`Field "${key}" must be a string`);
      }
    }
    const usable = raw
      .map(([key, value]) => [key, (value as string).trim()] as [string, string])
      .filter(([, value]) => value.length > 0)
      .slice(0, MAX_FIELDS);
    if (usable.length === 0) {
      throw new BadRequestException('There is nothing to translate — fill in at least one English field first');
    }
    for (const [key, value] of usable) {
      if (value.length > MAX_FIELD_CHARS) {
        throw new BadRequestException(`Field "${key}" is too long to translate in one request`);
      }
    }

    const runtime = await this.settings.getRuntimeConfig(tenantId);

    const system = [
      'You are a professional technical translator for a CNC machining education platform.',
      `Translate the user's JSON values from English into ${targetLocale === 'ar' ? 'Modern Standard Arabic' : targetLocale}.`,
      'Rules:',
      '- Preserve meaning and technical accuracy. Keep product and course names, model numbers, units and acronyms (CNC, CAD, CAM, 5-axis, ISO, mada) unchanged.',
      '- Return ONLY valid JSON. No prose, no markdown fences, no commentary.',
      '- Use the same keys as the input and the same number of values.',
      '- Keep placeholders, numbers and URLs exactly as they appear.',
      '- If a value is already Arabic, return it unchanged.',
    ].join('\n');

    const payload = Object.fromEntries(usable);
    let content: string;
    let usedFallback = false;
    let model = runtime.primaryModel;
    try {
      const result = await this.provider.complete({
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        model: runtime.primaryModel,
        fallbackModel: runtime.fallbackModel,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: input.entity
              ? `Translate these ${input.entity} fields:\n${JSON.stringify(payload, null, 2)}`
              : `Translate these fields:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        // Translation is close to deterministic; a little temperature lets the model pick the
        // natural Arabic phrasing instead of repeating one template.
        maxTokens: runtime.maxTokens,
        temperature: Math.max(runtime.temperature, 0.2),
        timeoutMs: runtime.timeoutMs,
      });
      content = result.content;
      usedFallback = result.usedFallback;
      model = result.model;
    } catch (error) {
      const code = error instanceof AiProviderError ? error.code : 'provider_error';
      this.logger.warn(`Translation failed (${code})`);
      throw new ServiceUnavailableException(
        code === 'missing_api_key'
          ? 'Add an AI provider key in AI Assistant settings before translating'
          : 'The AI provider could not complete the translation',
      );
    }

    const translations = this.parse(content, usable.map(([key]) => key));
    return { targetLocale, translations, model, usedFallback };
  }

  /**
   * Pull the object out of a model reply.
   *
   * Providers wrap JSON in prose or markdown fences often enough that a bare `JSON.parse` of the
   * whole response fails often enough to be a real problem. The first balanced object is tried,
   * then fenced blocks, then any `{...}` span.
   */
  private parse(raw: string, keys: string[]): Record<string, string> {
    const candidates: string[] = [];
    const balanced = firstBalancedObject(raw);
    if (balanced) candidates.push(balanced);
    for (const match of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
      if (match[1]) candidates.push(match[1].trim());
    }
    const open = raw.indexOf('{');
    const close = raw.lastIndexOf('}');
    if (open >= 0 && close > open) candidates.push(raw.slice(open, close + 1));

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const source = parsed as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const key of keys) {
          const value = source[key];
          if (typeof value === 'string' && value.trim()) out[key] = value.trim();
        }
        if (Object.keys(out).length > 0) return out;
      } catch {
        // try the next candidate
      }
    }
    throw new ServiceUnavailableException(
      'The AI provider did not return a usable translation — try again',
    );
  }
}

/** The first `{...}` span whose braces balance, ignoring braces inside strings. */
function firstBalancedObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}


export interface TranslateGroupInput {
  /** Stable key the caller uses to match results back, e.g. a lesson id. */
  key: string;
  /** Label -> English source text. */
  fields: Record<string, string>;
}

export interface TranslateGroupResult {
  key: string;
  translations: Record<string, string>;
  /** Set when this group failed; other groups still return. */
  error?: string;
}

export interface TranslateGroupsResult {
  groups: TranslateGroupResult[];
  /** Fields translated across every group. */
  translatedCount: number;
  /** Groups that failed. */
  failedCount: number;
  model: string;
  usedFallback: boolean;
}

export interface TranslateGroupsInput {
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
  groups: TranslateGroupInput[];
  entity?: string;
}

/**
 * Translate many field groups.
 *
 * A course is lessons × (title, description, blocks); a page is every string prop in its block
 * tree. Both exceed the single-request field cap, so work is split into batches and each batch is
 * a separate model call.
 *
 * Failure is per group, not per request. One lesson whose transcript is too long, or a rate limit
 * hit on batch four, must not discard the three batches that already succeeded — a partial
 * translation the editor can review and top up is far more useful than an all-or-nothing error.
 */
@Injectable()
export class AiTranslationBatchService {
  private readonly logger = new Logger(AiTranslationBatchService.name);

  constructor(private readonly translation: AiTranslationService) {}

  async translateGroups(tenantId: string, input: TranslateGroupsInput): Promise<TranslateGroupsResult> {
    const sourceLocale = input.sourceLocale;
    const targetLocale = input.targetLocale;
    if (sourceLocale !== 'en') {
      throw new BadRequestException('Only English can be used as the translation source');
    }
    if (targetLocale !== 'ar') {
      throw new BadRequestException('Only Arabic is supported as a translation target');
    }

    const groups = input.groups ?? [];
    if (groups.length === 0) {
      throw new BadRequestException('Nothing to translate');
    }
    if (groups.length > 200) {
      throw new BadRequestException('Too many items in one request — translate in batches');
    }

    const results: TranslateGroupResult[] = [];
    let translatedCount = 0;
    let failedCount = 0;
    let lastModel = '';
    let anyFallback = false;

    // Flatten into batches that respect the per-request field cap, keeping group boundaries.
    let batch: Array<{ group: TranslateGroupInput; fields: Record<string, string> }> = [];
    let batchFields = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      const payload = batch.reduce<Record<string, string>>((acc, item) => ({ ...acc, ...item.fields }), {});
      try {
        const result = await this.translation.translateFields(tenantId, {
          sourceLocale: 'en',
          targetLocale: 'ar',
          fields: payload,
          entity: input.entity,
        });
        lastModel = result.model;
        anyFallback = anyFallback || result.usedFallback;
        // Split the flat reply back onto the groups that contributed each label.
        for (const item of batch) {
          const own: Record<string, string> = {};
          for (const label of Object.keys(item.fields)) {
            const value = result.translations[label];
            if (value) own[label] = value;
          }
          results.push({ key: item.group.key, translations: own });
          translatedCount += Object.keys(own).length;
        }
      } catch (error) {
        failedCount += batch.length;
        const message = error instanceof Error ? error.message : 'Translation failed';
        this.logger.warn(`Batch of ${batch.length} group(s) failed: ${message}`);
        for (const item of batch) results.push({ key: item.group.key, translations: {}, error: message });
      }
      batch = [];
      batchFields = 0;
    };

    for (const group of groups) {
      const fields: Record<string, string> = {};
      for (const [label, value] of Object.entries(group.fields ?? {})) {
        if (typeof value === 'string' && value.trim()) fields[label] = value;
      }
      if (Object.keys(fields).length === 0) {
        results.push({ key: group.key, translations: {} });
        continue;
      }
      const count = Object.keys(fields).length;
      if (batchFields + count > MAX_FIELDS && batch.length > 0) await flush();
      batch.push({ group, fields });
      batchFields += count;
    }
    await flush();

    // Preserve the caller's ordering regardless of how batches interleaved.
    const order = new Map(groups.map((g, i) => [g.key, i]));
    results.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

    return { groups: results, translatedCount, failedCount, model: lastModel, usedFallback: anyFallback };
  }
}
