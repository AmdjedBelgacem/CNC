import { describe, expect, it } from 'vitest';
import { AiProviderError, AiProviderService } from '../src/modules/ai/ai-provider.service';

const svc = new AiProviderService({ get: () => undefined } as never);
const SECRET = 'sk-abcdef1234567890abcdef1234567890';

type Internals = {
  requestJson(baseUrl: string, endpoint: string, payload: object, apiKey: string, timeoutMs: number): Promise<unknown>;
  describeEmptyCompletion(choices: unknown[], model: string): string;
};
const internals = svc as unknown as Internals;

/** Drive a fake provider response through requestJson and return the surfaced message. */
async function messageFor(bodyText: string, status = 400, apiKey = SECRET): Promise<string | undefined> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(bodyText, { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
  try {
    await internals.requestJson('https://api.deepseek.com', '/chat/completions', {}, apiKey, 5000);
    return 'RESOLVED_UNEXPECTEDLY';
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return (error as AiProviderError).providerMessage;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('AiProviderError upstream detail', () => {
  it('carries the upstream status alongside the code', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('nope', { status: 429 })) as unknown as typeof fetch;
    try {
      await internals.requestJson('https://api.deepseek.com', '/chat/completions', {}, SECRET, 5000);
      throw new Error('expected rejection');
    } catch (error) {
      const err = error as AiProviderError;
      expect(err.code).toBe('http_error');
      expect(err.providerStatus).toBe(429);
      expect(err.retryable).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps provider message, code and type', async () => {
    const message = await messageFor(
      JSON.stringify({
        error: { message: 'Authentication Fails, Your api key is invalid', code: 'invalid_request_error', type: 'authentication_error' },
      }),
    );
    expect(message).toContain('Authentication Fails');
    expect(message).toContain('code=invalid_request_error');
    expect(message).toContain('type=authentication_error');
  });
});

describe('provider error redaction', () => {
  it('redacts the exact api key echoed back by the provider', async () => {
    const message = await messageFor(JSON.stringify({ error: { message: `bad key ${SECRET}` } }));
    expect(message).not.toContain(SECRET);
    expect(message).toContain('[redacted]');
  });

  it('redacts sk- keys that differ from the configured one', async () => {
    const message = await messageFor(JSON.stringify({ error: { message: 'rejected sk-zzzz9999yyyy8888xxxx' } }));
    expect(message).not.toContain('zzzz9999yyyy8888');
    expect(message).toContain('[redacted]');
  });

  it('redacts bearer tokens and authorization fields', async () => {
    const message = await messageFor(
      JSON.stringify({ error: { message: 'sent Authorization: Bearer abc.def.ghi', authorization: 'Bearer abc.def.ghi' } }),
    );
    expect(message).not.toContain('abc.def.ghi');
  });

  it('truncates an oversized body', async () => {
    const message = await messageFor(JSON.stringify({ error: { message: 'x'.repeat(5000) } }));
    expect(message!.length).toBeLessThanOrEqual(500);
  });

  it('survives a non-JSON error body', async () => {
    expect(await messageFor('<html>502 Bad Gateway</html>')).toContain('502 Bad Gateway');
  });

  it('returns undefined for an empty body', async () => {
    expect(await messageFor('')).toBeUndefined();
  });
});

describe('empty completion diagnostics', () => {
  it('explains a thinking model that spent the budget on reasoning', () => {
    const message = internals.describeEmptyCompletion(
      [{ message: { reasoning_content: 'thinking...' }, finish_reason: 'length' }],
      'deepseek-flash',
    );
    expect(message).toContain('thinking model');
    expect(message).toContain('deepseek-flash');
    expect(message).toContain('finish_reason=length');
  });

  it('describes a genuinely empty completion', () => {
    const message = internals.describeEmptyCompletion([{ message: { content: '' }, finish_reason: 'stop' }], 'gpt-4o-mini');
    expect(message).toContain('empty content');
    expect(message).toContain('finish_reason=stop');
  });

  it('reports a missing choices array', () => {
    expect(internals.describeEmptyCompletion([], 'x')).toContain('no choices');
  });
});