import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colorProp } from '../src/components/builder/layout-style';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * The AI builder panel and the block-rendering defects it exposed.
 *
 * AI-built sections were the first layouts to use literal colours and nested stacks heavily,
 * which is how these surfaced: they affected hand-built pages just the same.
 */
describe('block colours', () => {
  it('renders literal colours inline and theme colours as classes', () => {
    expect(colorProp('#1c1917')).toEqual({ style: { color: '#1c1917' } });
    expect(colorProp('rgb(1, 2, 3)').style.color).toBe('rgb(1, 2, 3)');
    expect(colorProp('hsl(20 50% 40%)').style.color).toBe('hsl(20 50% 40%)');
    expect(colorProp('var(--c-primary)').style.color).toBe('var(--c-primary)');
    expect(colorProp('text-primary')).toEqual({ className: 'text-primary', style: {} });
    expect(colorProp(undefined)).toEqual({ style: {} });
  });

  it('is used by every text-like block', () => {
    for (const file of ['heading-block', 'text-block', 'icon-block', 'badge-block']) {
      expect(read(`components/builder/blocks/${file}.tsx`)).toContain('colorProp(');
    }
    // A hex value must never reach the class list again.
    expect(read('components/builder/blocks/heading-block.tsx')).not.toContain("color ?? 'text-text-primary'");
  });

  it('lets cards and buttons take exact colours', () => {
    expect(read('components/builder/blocks/card-block.tsx')).toContain('backgroundColor: bgColor');
    expect(read('components/builder/blocks/button-block.tsx')).toContain('backgroundColor: bgColor');
  });
});

describe('nested stacks', () => {
  it('does not let a row stack turn the column stacks inside it into rows', () => {
    const css = read('styles/globals.css');
    expect(css).toMatch(/@property --stack-direction\s*\{[^}]*inherits:\s*false/);
  });
});

describe('AI builder panel', () => {
  const panel = read('components/builder/ai/ai-builder-panel.tsx');
  const store = read('components/builder/ai/ai-chat-store.ts');
  const editor = read('app/(admin)/admin/builder/builder-editor.tsx');

  it('applies results as one undoable step without auto-seeding the AI\'s empty slots', () => {
    expect(editor).toContain('recordHistory: true');
    expect(editor).toMatch(/applyAiLayout[\s\S]*seen!?\.add\(id\)/);
  });

  it('never applies a result to a page other than the one it was asked about', () => {
    expect(store).toContain('input.currentSlug() === slug');
  });

  it('downscales pictures under the API body limit before upload', () => {
    expect(store).toContain('url.length < 850_000');
  });

  it('sends the live layout, so unsaved edits are what the AI changes', () => {
    expect(store).toContain('getLiveLayout()');
  });

  it('keeps the Arabic pill out of the way of the composer', () => {
    expect(editor).toContain('!aiPanelOpen');
    expect(panel).toContain("t('send')");
  });
});
