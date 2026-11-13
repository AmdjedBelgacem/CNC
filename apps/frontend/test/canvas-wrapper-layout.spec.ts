import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canvasItemRules, isOutOfFlow } from '../src/components/builder/blocks/element-block';

/**
 * The builder canvas wraps every block in a drag wrapper. The homepage hero's floating cards
 * (absolute, pinned to the visual's bottom corners) rose to the top on the canvas, and the
 * 5-axis card's `flex: 1` picture area stopped filling the card. Both now lay out as on the page.
 */
describe('out-of-flow elements on the canvas', () => {
  it('detects absolute and fixed positioning, desktop or phone', () => {
    expect(isOutOfFlow('position: absolute; right: 0; bottom: 0')).toBe(true);
    expect(isOutOfFlow('display:flex;position:fixed')).toBe(true);
    expect(isOutOfFlow('display: flex', 'position: absolute')).toBe(true);
    expect(isOutOfFlow('position: relative; min-height: 460px')).toBe(false);
    expect(isOutOfFlow('position: sticky; top: 0')).toBe(false);
  });

  it('makes the drag wrapper static so the element anchors where it does on the page', () => {
    const css = readFileSync(join(__dirname, '..', 'src/styles/globals.css'), 'utf8');
    expect(css).toMatch(/\[data-puck-component\]:has\(> \[data-builder-out-of-flow\]\)\s*\{\s*position: static !important;/);
  });
});

describe('flex and grid item properties on the canvas', () => {
  it('moves item properties onto the wrapper and lets the element fill it', () => {
    const rules = canvasItemRules('tel-abc', 'flex: 1; display: flex; padding: 24px', undefined);
    expect(rules).toContain('[data-puck-component]:has(> .tel-abc){flex: 1; display: flex; min-width: 0}');
    expect(rules).toContain('> .tel-abc{flex: 1 1 auto; min-width: 0}');
    expect(rules).not.toContain('padding');
  });

  it('handles grid placement and phone rules', () => {
    const rules = canvasItemRules('tel-g', 'grid-column: span 2', 'grid-column: auto');
    expect(rules).toContain('grid-column: span 2');
    expect(rules).toMatch(/@media \(max-width: 767px\)\{\[data-puck-component\]:has\(> \.tel-g\)\{grid-column: auto/);
  });

  it('adds nothing for an element that is not placed by its parent', () => {
    expect(canvasItemRules('tel-x', 'display: grid; gap: 8px', '')).toBe('');
  });
});
