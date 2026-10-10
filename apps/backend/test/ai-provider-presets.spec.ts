import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AI_PROVIDER_PRESETS, aiProviderDefaults } from '@titan/shared';

/**
 * Selecting DeepSeek must leave the assistant pointing at DeepSeek.
 *
 * The failure mode this pins down: the stored provider changed to `deepseek` while the OpenAI
 * base URL and model stayed in place, so every request failed against a host that was never
 * given a key. The preset has to supply both values when the author has not typed either.
 */
describe('DeepSeek as a named provider preset', () => {
  it('supplies the base URL and model the user asked for', () => {
    const deepseek = AI_PROVIDER_PRESETS.find((preset) => preset.id === 'deepseek');
    expect(deepseek).toBeDefined();
    expect(deepseek?.baseUrl).toBe('https://api.deepseek.com');
    expect(deepseek?.primaryModel).toBe('deepseek-flash');
  });

  it('the settings service applies those defaults on save', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/ai/ai-settings.service.ts'),
      'utf8',
    );
    // The preset must be consulted for both fields, or the provider changes without the
    // endpoint following it.
    expect(src).toContain('aiProviderDefaults(provider)');
    const [baseUrlLine, modelLine] = [
      src.match(/const baseUrl = await this\.validateUrl\([\s\S]*?\);/),
      src.match(/const primaryModel = this\.cleanModel\([\s\S]*?\);/),
    ];
    expect(baseUrlLine).toBeTruthy();
    expect(modelLine).toBeTruthy();
    expect(baseUrlLine![0]).toContain('preset.baseUrl');
    expect(modelLine![0]).toContain('preset.primaryModel');
  });

  it('an explicit base URL or model still wins over the preset', () => {
    // The preset is a gap-filler, never an override.
    const src = readFileSync(
      resolve(__dirname, '../src/modules/ai/ai-settings.service.ts'),
      'utf8',
    );
    const [baseUrlLine, modelLine] = [
      src.match(/const baseUrl = await this\.validateUrl\([\s\S]*?\);/),
      src.match(/const primaryModel = this\.cleanModel\([\s\S]*?\);/),
    ];
    // `input.x ?? existing?.x ?? preset.x` — the author's value comes first.
    expect(baseUrlLine![0].indexOf('input.baseUrl')).toBeLessThan(baseUrlLine![0].indexOf('preset.baseUrl'));
    expect(modelLine![0].indexOf('input.primaryModel')).toBeLessThan(modelLine![0].indexOf('preset.primaryModel'));
  });

  it('the frontend offers DeepSeek in the provider selector', () => {
    const page = readFileSync(
      resolve(__dirname, '../../frontend/src/app/(admin)/admin/settings/ai-assistant/page.tsx'),
      'utf8',
    );
    expect(page).toContain('value="deepseek"');
    // And prefills the endpoint, which is the half of the fix that is easy to forget.
    expect(page).toContain('AI_PROVIDER_PRESETS');
  });

  it('the host allowlist admits api.deepseek.com, or production rejects the URL', () => {
    const example = readFileSync(
      resolve(__dirname, '../../../deploy/lightsail/.env.example'),
      'utf8',
    );
    const line = example.split('\n').find((entry) => entry.startsWith('AI_PROVIDER_ALLOWED_HOSTS='));
    expect(line).toBeTruthy();
    expect(line).toContain('api.deepseek.com');
    expect(line).toContain('api.openai.com');
  });

  it('an unknown provider gets no invented defaults', () => {
    expect(aiProviderDefaults('not-a-real-provider')).toEqual({});
  });
});

/**
 * The API must report the provider that is actually stored.
 *
 * `toMasked` hardcoded `provider: 'openai-compatible'`, so saving a DeepSeek config returned a
 * response describing OpenAI. The assistant would be pointed at the wrong host while the API
 * insisted otherwise — the failure the preset exists to prevent, reintroduced one layer up.
 */
describe('the API reports the stored provider', () => {
  it('does not hardcode the provider in the masked response', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/ai/ai-settings.service.ts'),
      'utf8',
    );
    const masked = src.slice(src.indexOf('private toMasked'), src.indexOf('private toMasked') + 1400);
    expect(masked).toContain('provider: row?.provider ||');
    expect(masked).not.toMatch(/provider:\s*'openai-compatible'/);
  });

  /**
   * The runtime path must accept a configured provider, not just OpenAI.
   *
   * `getRuntimeConfig` threw `unsupported_provider` for anything else, so a DeepSeek config was
   * stored correctly and then refused to run — the same failure as the hardcoded response field,
   * one layer deeper.
   */
  it('the runtime path accepts any saved provider rather than only OpenAI', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/modules/ai/ai-settings.service.ts'),
      'utf8',
    );
    const runtime = src.slice(src.indexOf('async getRuntimeConfig'), src.indexOf('async getRuntimeConfig') + 1600);
    expect(runtime).not.toContain("row.provider !== 'openai-compatible'");
    expect(runtime).toContain('if (!row.provider)');
  });
});
