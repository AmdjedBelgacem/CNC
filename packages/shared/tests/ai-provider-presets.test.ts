import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDER_PRESETS,
  aiProviderDefaults,
  aiProviderPreset,
} from '../src/ai/providers';

/**
 * DeepSeek is offered as a named preset rather than a different protocol: the assistant speaks
 * the OpenAI chat-completions protocol and DeepSeek implements it, so the only difference is
 * where the requests go.
 *
 * The failure this guards against is selecting "DeepSeek" and having the stored provider change
 * while the OpenAI base URL and model stay put — every request then fails against a host that
 * was never given a key.
 */
describe('AI provider presets', () => {
  it('offers DeepSeek with the base URL and model the user asked for', () => {
    const deepseek = aiProviderPreset('deepseek');
    expect(deepseek).toBeDefined();
    expect(deepseek?.baseUrl).toBe('https://api.deepseek.com');
    expect(deepseek?.primaryModel).toBe('deepseek-flash');
  });

  it('keeps the generic OpenAI-compatible endpoint available', () => {
    const generic = aiProviderPreset('openai-compatible');
    expect(generic?.baseUrl).toBe('https://api.openai.com/v1');
    expect(generic?.primaryModel).toBe('gpt-4o-mini');
  });

  /**
   * The shared lookup is exact-match on the stored id. Alias handling (`openai`,
   * `OpenAI_Compatible`) belongs to the backend's `normalizeProvider`, which is where an
   * unrecognised value is rejected — keeping that here would duplicate the rule.
   */
  it('matches the stored id exactly, leaving aliases to the backend', () => {
    expect(aiProviderPreset('openai-compatible')?.id).toBe('openai-compatible');
    expect(aiProviderPreset('deepseek')?.id).toBe('deepseek');
    expect(aiProviderPreset('openai')).toBeUndefined();
  });

  it('returns defaults for a known provider and nothing for an unknown one', () => {
    expect(aiProviderDefaults('deepseek')).toEqual({
      baseUrl: 'https://api.deepseek.com',
      primaryModel: 'deepseek-flash',
    });
    // An unrecognised provider must not invent a base URL or model.
    expect(aiProviderDefaults('not-a-provider')).toEqual({});
    expect(aiProviderDefaults(undefined)).toEqual({});
    expect(aiProviderDefaults('')).toEqual({});
  });

  it('exposes every preset id for the selector', () => {
    expect(AI_PROVIDER_PRESETS.map((preset) => preset.id)).toContain('deepseek');
    expect(AI_PROVIDER_PRESETS.map((preset) => preset.id)).toContain('openai-compatible');
  });

  it('gives every preset a non-empty label, base URL and model', () => {
    for (const preset of AI_PROVIDER_PRESETS) {
      expect(preset.label.trim().length, preset.id).toBeGreaterThan(0);
      expect(preset.baseUrl, preset.id).toMatch(/^https:\/\//);
      expect(preset.primaryModel.trim().length, preset.id).toBeGreaterThan(0);
    }
  });
});
