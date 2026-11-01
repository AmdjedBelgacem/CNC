import { describe, expect, it } from 'vitest';
import { ISLAND_HEAD, ISLAND_PAD, LIVE_ISLAND_VARIANTS } from '../src';
import { liveIslandHeaderSeed } from '../src/blocks/live-island-parts';

/**
 * The public island components and the builder canvas both read their padding and
 * header type from `island-style`. These tests keep that true: a variant that gains
 * a header seed without a padding entry would fall back to a guess in the canvas.
 */
describe('island style single source', () => {
  const seeded = LIVE_ISLAND_VARIANTS.filter((v) => liveIslandHeaderSeed(v, 'x') !== null);

  it('has at least one seeded header', () => {
    expect(seeded.length).toBeGreaterThan(0);
  });

  it.each(seeded)('%s has shared padding', (variant) => {
    const pad = (ISLAND_PAD as Record<string, { section: string; top: string; bottom: string } | undefined>)[variant];
    expect(pad, `${variant} is missing from ISLAND_PAD`).toBeDefined();
    // The top-only class must be the same step as the section's vertical padding.
    expect(pad!.top).toBe(pad!.section.replace(/py-/g, 'pt-'));
    expect(pad!.bottom).toBe(pad!.section.replace(/py-/g, 'pb-'));
  });

  it('seeds the eyebrow with the shared label class, not a one-off style', () => {
    for (const variant of seeded) {
      const json = JSON.stringify(liveIslandHeaderSeed(variant, 'x'));
      expect(json).toContain(`"className":"${ISLAND_HEAD.eyebrow}"`);
      expect(json).not.toContain('font-mono');
    }
  });
});
