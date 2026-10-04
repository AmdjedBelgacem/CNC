import { describe, expect, it } from 'vitest';
import { getAiErrorMessage } from '../src/hooks/use-ai-assistant';

/** Mimics the Error shape api-client.ts throws. */
function apiError(status: number, body: Record<string, unknown>): Error {
  const err = new Error((body.message as string) || 'API Error') as Error & {
    status?: number;
    body?: Record<string, unknown>;
  };
  err.status = status;
  err.body = body;
  return err;
}

describe('getAiErrorMessage', () => {
  it('falls back to the message when no body was attached', () => {
    const err = new Error('Network Error');
    expect(getAiErrorMessage(err)).toBe('Network Error');
  });

  it('handles non-Error throws', () => {
    expect(getAiErrorMessage('boom')).toBe('AI assistant request failed');
  });

  it('keeps the concise form free of provider internals by default', () => {
    const message = getAiErrorMessage(
      apiError(503, {
        statusCode: 503,
        message: 'AI provider test failed',
        aiErrorCode: 'blocked_url',
        providerStatus: 403,
        providerMessage: 'internal detail that must not reach end users',
      }),
    );
    expect(message).toContain('AI provider test failed');
    expect(message).toContain('private or blocked address');
    expect(message).not.toContain('internal detail');
  });

  it('surfaces the upstream status and text in detailed mode', () => {
    const message = getAiErrorMessage(
      apiError(503, {
        statusCode: 503,
        message: 'AI provider test failed',
        aiErrorCode: 'http_error',
        providerStatus: 400,
        providerMessage: 'The supported API model names are deepseek-flash.',
      }),
      { detailed: true },
    );
    expect(message).toContain('code: http_error');
    expect(message).toContain('provider HTTP: 400');
    expect(message).toContain('deepseek-flash');
  });

  it('explains a 404 as a wrong base URL path', () => {
    const message = getAiErrorMessage(
      apiError(503, { message: 'AI provider test failed', aiErrorCode: 'http_error', providerStatus: 404 }),
      { detailed: true },
    );
    expect(message).toContain('base URL path is wrong');
  });

  it('flags a rejected API key on 401/403', () => {
    for (const providerStatus of [401, 403]) {
      const message = getAiErrorMessage(
        apiError(503, { message: 'AI provider test failed', aiErrorCode: 'http_error', providerStatus }),
        { detailed: true },
      );
      expect(message).toContain('the stored API key was rejected');
    }
  });

  it('explains the empty-completion token budget trap', () => {
    const message = getAiErrorMessage(
      apiError(503, {
        message: 'AI provider test failed',
        aiErrorCode: 'empty_completion',
        providerMessage: 'returned empty content after 34 reasoning chars',
      }),
      { detailed: true },
    );
    expect(message).toContain('token budget too small');
    expect(message).toContain('34 reasoning chars');
  });

  it('uses the config reason for save/load faults', () => {
    const message = getAiErrorMessage(
      apiError(503, { message: 'AI assistant is unavailable', reason: 'api_key_undecryptable', detail: 're-save it' }),
      { detailed: true },
    );
    expect(message).toContain('code: api_key_undecryptable');
    expect(message).toContain('re-save it');
  });

  it('degrades to the raw message when the body has nothing useful', () => {
    const message = getAiErrorMessage(apiError(500, { message: 'Internal Server Error' }), { detailed: true });
    expect(message).toBe('Internal Server Error');
  });
});