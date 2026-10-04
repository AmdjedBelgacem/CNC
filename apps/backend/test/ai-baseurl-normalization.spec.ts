import { describe, expect, it } from 'vitest';
import { AiProviderError, AiProviderService } from '../src/modules/ai/ai-provider.service';
import { AiSettingsService } from '../src/modules/ai/ai-settings.service';

const normalize = (value: string) =>
  (AiSettingsService.prototype as unknown as { toProviderBaseUrl(v: string): string }).toProviderBaseUrl(value);

describe('base URL normalization on save', () => {
  it.each([
    ['https://api.deepseek.com/chat/completions', 'https://api.deepseek.com'],
    ['https://api.deepseek.com/v1/chat/completions', 'https://api.deepseek.com/v1'],
    ['https://api.deepseek.com/', 'https://api.deepseek.com'],
    ['https://api.deepseek.com', 'https://api.deepseek.com'],
    ['  https://api.deepseek.com/chat/completions  ', 'https://api.deepseek.com'],
    ['https://api.openai.com/v1/embeddings', 'https://api.openai.com/v1'],
    ['https://api.deepseek.com//chat//completions', 'https://api.deepseek.com'],
    ['https://api.deepseek.com/responses', 'https://api.deepseek.com'],
    ['https://gateway.internal:8080/proxy/v1/models', 'https://gateway.internal:8080/proxy/v1'],
    ['http://localhost:11434/v1', 'http://localhost:11434/v1'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it('does not mangle a host that merely looks like a suffix', () => {
    expect(normalize('https://models.example.com')).toBe('https://models.example.com');
    expect(normalize('https://chat.example.com/v1')).toBe('https://chat.example.com/v1');
  });

  it('strips a bare completions segment', () => {
    expect(normalize('https://api.deepseek.com/completions')).toBe('https://api.deepseek.com');
  });
});

describe('empty-completion retry', () => {
  const exhaustedBody = JSON.stringify({
    choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'thinking hard' }, finish_reason: 'length' }],
    usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
  });
  const okBody = JSON.stringify({
    choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
  });
  const emptyStopBody = JSON.stringify({
    choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'done' }, finish_reason: 'stop' }],
  });

  function stubFetch(bodies: string[]) {
    const calls: Array<{ maxTokens: number }> = [];
    let i = 0;
    globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { max_tokens: number };
      calls.push({ maxTokens: body.max_tokens });
      const payload = bodies[Math.min(i, bodies.length - 1)]!;
      i += 1;
      return new Response(payload, { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    return calls;
  }

  const svc = new AiProviderService({ get: () => undefined } as never);
  const input = {
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'sk-testtesttest1234',
    model: 'deepseek-flash',
    fallbackModel: null,
    messages: [{ role: 'user' as const, content: 'hi' }],
    maxTokens: 256,
    temperature: 0,
    timeoutMs: 5000,
  };

  it('retries with a larger budget when the budget is exhausted', async () => {
    const original = globalThis.fetch;
    const calls = stubFetch([exhaustedBody, okBody]);
    try {
      const result = await svc.complete(input);
      expect(result.content).toBe('OK');
      expect(calls).toEqual([{ maxTokens: 256 }, { maxTokens: 1024 }]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('does not retry a non-length empty completion', async () => {
    const original = globalThis.fetch;
    const calls = stubFetch([emptyStopBody]);
    try {
      await expect(svc.complete(input)).rejects.toThrow(AiProviderError);
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('reports empty_completion when the retry also yields nothing', async () => {
    const original = globalThis.fetch;
    stubFetch([exhaustedBody]);
    try {
      await expect(svc.complete(input)).rejects.toMatchObject({
        code: 'empty_completion',
        providerMessage: expect.stringContaining('thinking model'),
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('does not retry when already at the 8000 ceiling', async () => {
    const original = globalThis.fetch;
    const calls = stubFetch([exhaustedBody]);
    try {
      await expect(svc.complete({ ...input, maxTokens: 8000 })).rejects.toMatchObject({ code: 'empty_completion' });
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('never exceeds the 8000 ceiling when raising the budget', async () => {
    const original = globalThis.fetch;
    const calls = stubFetch([exhaustedBody, okBody]);
    try {
      await svc.complete({ ...input, maxTokens: 4000 });
      expect(calls[1]!.maxTokens).toBe(8000);
    } finally {
      globalThis.fetch = original;
    }
  });
});