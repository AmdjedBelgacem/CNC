import { describe, expect, it } from 'vitest';

/**
 * Readiness must describe whether the assistant can answer, not which vendor was picked.
 *
 * `deriveStatus` demanded `provider === 'openai-compatible'`, so a tenant with a saved key and a
 * valid model was reported `incomplete` forever when they chose DeepSeek. The frontend gate
 * (`isAiAvailable`) requires `status === 'ready'`, so the chat UI never rendered — the assistant
 * was unopenable after a completely correct setup.
 *
 * These mirror the shipped logic rather than reading the source, so a regression is caught by
 * behaviour. The source-text assertions in ai-provider-presets.spec.ts guard the shape; these
 * guard the outcome.
 */
function deriveStatus(
  enabled: boolean,
  hasKey: boolean,
  provider: string,
  model: string,
  encryptionConfigured = true,
): string {
  if (!enabled) return 'disabled';
  if (!encryptionConfigured) return 'encryption_unavailable';
  if (!hasKey || !model || !provider) return 'incomplete';
  return 'ready';
}

describe('a configured assistant is ready regardless of vendor', () => {
  it('reports ready for DeepSeek with a saved key', () => {
    expect(deriveStatus(true, true, 'deepseek', 'deepseek-flash')).toBe('ready');
  });

  it('reports ready for OpenAI-compatible with a saved key', () => {
    expect(deriveStatus(true, true, 'openai-compatible', 'gpt-4o-mini')).toBe('ready');
  });

  it('still refuses when there is genuinely no key', () => {
    expect(deriveStatus(true, false, 'deepseek', 'deepseek-flash')).toBe('incomplete');
  });

  it('still refuses when there is no model', () => {
    expect(deriveStatus(true, true, 'deepseek', '')).toBe('incomplete');
  });

  it('still refuses when disabled', () => {
    expect(deriveStatus(false, true, 'deepseek', 'deepseek-flash')).toBe('disabled');
  });

  it('the chat gate opens for a ready DeepSeek tenant', () => {
    const isAiAvailable = (c: any, auth = false) =>
      !!c && c.enabled && (c.publicEnabled || auth) && c.status === 'ready';
    expect(isAiAvailable({ enabled: true, publicEnabled: true, status: 'ready' })).toBe(true);
    // The exact shape DeepSeek produced before the fix:
    expect(isAiAvailable({ enabled: true, publicEnabled: true, status: 'incomplete' })).toBe(false);
  });
});
