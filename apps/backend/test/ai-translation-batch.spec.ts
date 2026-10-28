import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiProviderError } from '../src/modules/ai/ai-provider.service';
import {
  AiTranslationBatchService,
  AiTranslationService,
  translationTokenBudget,
} from '../src/modules/ai/ai-translation.service';

/**
 * Bulk translation budget and chunking.
 *
 * A page-sized batch used to be sent as one 40-field model call with the tenant's chat budget
 * (1024 output tokens) and the chat timeout (15s). Against the production DeepSeek config that
 * call consistently timed out, so the builder's "translate the page" action failed for every
 * field. These tests pin the two properties that fixed it: translation gets its own output and
 * time budget, and a group is split into small chunks so one slow chunk cannot discard the rest.
 */

const runtime = {
  tenantId: 'tenant',
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.deepseek.com',
  apiKey: 'sk-test-key-1234567890',
  primaryModel: 'deepseek-flash',
  fallbackModel: 'deepseek-flash',
  timeoutMs: 15000,
  maxTokens: 1024,
  temperature: 0.2,
  embeddingModel: null,
  embeddingBaseUrl: null,
};

function makeFields(count: number): Record<string, string> {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`f${index}`, `text ${index}`]));
}

function makeTranslationService(complete: (input: Record<string, unknown>) => unknown) {
  const settings = { getRuntimeConfig: vi.fn(async () => runtime) };
  const provider = { complete: vi.fn(complete) };
  const service = new AiTranslationService(provider as never, settings as never);
  return { service, provider, settings };
}

function makeBatchService(handler: (input: Record<string, unknown>) => unknown) {
  const calls: Array<{ fields: Record<string, string>; entity?: string }> = [];
  const translation = {
    translateFields: vi.fn(async (_tenant: string, input: Record<string, unknown>) => {
      calls.push(input as { fields: Record<string, string>; entity?: string });
      return handler(input);
    }),
  };
  const service = new AiTranslationBatchService(translation as never);
  return { service, calls, translation };
}

function translationsFor(input: Record<string, unknown>): Record<string, string> {
  const fields = input.fields as Record<string, string>;
  return Object.fromEntries(Object.keys(fields).map((key) => [key, `ar:${key}`]));
}

describe('translationTokenBudget', () => {
  it('never drops below the translation minimum', () => {
    expect(translationTokenBudget(1024, [['a', 'x']])).toBeGreaterThanOrEqual(2048);
  });

  it('grows with the input and stops at the provider cap', () => {
    const small = translationTokenBudget(1024, [['a', 'x']]);
    const large = translationTokenBudget(
      1024,
      Array.from({ length: 40 }, (_, index) => [`f${index}`, 'x'.repeat(200)]),
    );
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThanOrEqual(8000);
    expect(translationTokenBudget(8000, [['a', 'x']])).toBe(8000);
  });
});

describe('translateFields budget', () => {
  it('raises the output budget and timeout above the chat settings', async () => {
    const { service, provider } = makeTranslationService(async (input) => ({
      content: JSON.stringify({ title: 'عنوان' }),
      model: input.model,
      usedFallback: false,
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
    }));

    const result = await service.translateFields('tenant', {
      sourceLocale: 'en',
      targetLocale: 'ar',
      fields: { title: 'Title' },
    });

    expect(result.translations).toEqual({ title: 'عنوان' });
    const call = provider.complete.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.maxTokens as number).toBeGreaterThanOrEqual(2048);
    expect(call.timeoutMs as number).toBeGreaterThanOrEqual(60000);
  });

  it('retries once with a larger budget when the reply is truncated JSON', async () => {
    let calls = 0;
    const { service, provider } = makeTranslationService(async (input) => {
      calls += 1;
      return {
        content: calls === 1 ? '{"title": "عنوان"' : JSON.stringify({ title: 'عنوان' }),
        model: input.model,
        usedFallback: false,
        inputTokens: 10,
        outputTokens: 10,
        totalTokens: 20,
      };
    });

    const result = await service.translateFields('tenant', {
      sourceLocale: 'en',
      targetLocale: 'ar',
      fields: { title: 'Title' },
    });

    expect(result.translations).toEqual({ title: 'عنوان' });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    const first = provider.complete.mock.calls[0]![0] as Record<string, unknown>;
    const second = provider.complete.mock.calls[1]![0] as Record<string, unknown>;
    expect(second.maxTokens).toBeGreaterThan(first.maxTokens as number);
    expect(second.temperature).toBe(0);
  });

  it('rejects more than 40 fields instead of silently dropping the tail', async () => {
    const { service } = makeTranslationService(async () => {
      throw new Error('provider should not be called');
    });

    await expect(
      service.translateFields('tenant', {
        sourceLocale: 'en',
        targetLocale: 'ar',
        fields: makeFields(41),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('surfaces a provider timeout as a retryable message', async () => {
    const { service } = makeTranslationService(async () => {
      throw new AiProviderError('network_error', true);
    });

    await expect(
      service.translateFields('tenant', {
        sourceLocale: 'en',
        targetLocale: 'ar',
        fields: { title: 'Title' },
      }),
    ).rejects.toThrow(/timed out/i);
  });
});

describe('translateGroups chunking', () => {
  it('splits a large group into 12-field chunks and merges every translation', async () => {
    const { service, calls } = makeBatchService((input) => ({
      targetLocale: 'ar',
      translations: translationsFor(input),
      model: 'deepseek-flash',
      usedFallback: false,
    }));

    const result = await service.translateGroups('tenant', {
      sourceLocale: 'en',
      targetLocale: 'ar',
      groups: [{ key: 'page-0', fields: makeFields(40) }],
      entity: 'page content',
    });

    expect(calls.map((call) => Object.keys(call.fields).length)).toEqual([12, 12, 12, 4]);
    expect(calls.every((call) => call.entity === 'page content')).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(Object.keys(result.groups[0]!.translations)).toHaveLength(40);
    expect(result.groups[0]!.error).toBeUndefined();
    expect(result.translatedCount).toBe(40);
    expect(result.failedCount).toBe(0);
  });

  it('keeps successful chunks when one chunk fails', async () => {
    let call = 0;
    const { service } = makeBatchService((input) => {
      call += 1;
      if (call === 2) throw new Error('The AI provider timed out or could not be reached — try again');
      return {
        targetLocale: 'ar',
        translations: translationsFor(input),
        model: 'deepseek-flash',
        usedFallback: false,
      };
    });

    const result = await service.translateGroups('tenant', {
      sourceLocale: 'en',
      targetLocale: 'ar',
      groups: [{ key: 'page-0', fields: makeFields(40) }],
    });

    const group = result.groups[0]!;
    expect(group.translations.f0).toBe('ar:f0');
    expect(group.translations.f11).toBe('ar:f11');
    expect(group.translations.f12).toBeUndefined();
    expect(group.translations.f23).toBeUndefined();
    expect(group.translations.f24).toBe('ar:f24');
    expect(group.translations.f39).toBe('ar:f39');
    expect(group.error).toContain('timed out');
    expect(result.translatedCount).toBe(28);
    expect(result.failedCount).toBe(1);
  });

  it('keeps duplicate labels in separate groups from overwriting each other', async () => {
    const { service } = makeBatchService((input) => {
      const fields = input.fields as Record<string, string>;
      return {
        targetLocale: 'ar',
        translations: { title: `ar:${fields.title}` },
        model: 'deepseek-flash',
        usedFallback: false,
      };
    });

    const result = await service.translateGroups('tenant', {
      sourceLocale: 'en',
      targetLocale: 'ar',
      groups: [
        { key: 'a', fields: { title: 'First' } },
        { key: 'b', fields: { title: 'Second' } },
      ],
    });

    expect(result.groups[0]!.translations.title).toBe('ar:First');
    expect(result.groups[1]!.translations.title).toBe('ar:Second');
  });
});
