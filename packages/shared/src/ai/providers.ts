/**
 * Named AI provider presets.
 *
 * The assistant speaks the OpenAI chat-completions protocol, so any service implementing it
 * can be used by pointing `baseUrl` at it. These presets exist so an author picks a provider
 * instead of having to know a base URL and a model name, and so the two stay consistent: the
 * preset supplies both, and the form prefills from it.
 *
 * `openai-compatible` is the generic escape hatch — it keeps whatever base URL and model were
 * already configured, which is what makes it safe to offer alongside a named preset.
 */
export interface AiProviderPreset {
  /** Stored in `ai_provider_configs.provider`. */
  id: string;
  /** Label shown in the provider selector. */
  label: string;
  /** Default base URL, used when the author has not typed one. */
  baseUrl: string;
  /** Default primary model, used when the author has not typed one. */
  primaryModel: string;
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    primaryModel: 'gpt-4o-mini',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    primaryModel: 'deepseek-flash',
  },
];

export type AiProviderPresetId = (typeof AI_PROVIDER_PRESETS)[number]['id'];

/** The preset for a provider id, or undefined for an unrecognised one. */
export function aiProviderPreset(id: string | null | undefined): AiProviderPreset | undefined {
  if (!id) return undefined;
  const normalized = id.trim().toLowerCase().replace(/_/g, '-');
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === normalized);
}

/**
 * The defaults a provider implies, for use when the author has not overridden them.
 *
 * Returns `undefined` for both fields when the provider is unknown, so a save never invents a
 * base URL or model for something it does not recognise.
 */
export function aiProviderDefaults(
  id: string | null | undefined,
): { baseUrl?: string; primaryModel?: string } {
  const preset = aiProviderPreset(id);
  if (!preset) return {};
  return { baseUrl: preset.baseUrl, primaryModel: preset.primaryModel };
}

/** Every provider id the selector offers, in display order. */
export const AI_PROVIDER_IDS: readonly string[] = AI_PROVIDER_PRESETS.map((preset) => preset.id);
