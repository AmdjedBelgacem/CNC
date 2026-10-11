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
  fields: Record<string, string>;
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

    const entries = Object.entries(input.fields ?? {})
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
      .slice(0, MAX_FIELDS);
    if (entries.length === 0) {
      throw new BadRequestException('There is nothing to translate — fill in at least one English field first');
    }
    for (const [key, value] of entries) {
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

    const payload = Object.fromEntries(entries);
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

    const translations = this.parse(content, entries.map(([key]) => key));
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
