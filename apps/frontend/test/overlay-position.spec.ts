import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { overlayWidth, positionAbove, positionBelow, triggerBox } from '../src/lib/overlay-position';

/**
 * The notification panel must open *under* its bell and the AI panel *above* its button,
 * both right-aligned with their trigger and always fully on screen.
 */

const DESKTOP = { width: 1440, height: 900 };
// Bell sits in the top navigation, near the right edge.
const BELL = { right: 1400, bottom: 64, top: 24 };
// FAB sits bottom-right, 24px inset, 48px tall.
const FAB = { right: 1416, bottom: 876, top: 828 };

const onScreen = (box: { left: number; top: number; width: number; height: number }, v = DESKTOP) =>
  box.left >= 0 && box.top >= 0 && box.left + box.width <= v.width && box.top + box.height <= v.height;

describe('overlayWidth', () => {
  it('caps at the max on a normal desktop', () => {
    expect(overlayWidth(1440)).toBe(420);
  });

  it('never exceeds the viewport on a narrow window', () => {
    expect(overlayWidth(320)).toBeLessThanOrEqual(320);
  });

  it('has a usable floor on a tiny viewport', () => {
    expect(overlayWidth(200)).toBeGreaterThan(0);
  });
});

describe('positionBelow (notification bell)', () => {
  it('opens directly under the trigger', () => {
    const box = positionBelow(BELL, DESKTOP);
    expect(box.top).toBeGreaterThan(BELL.bottom);
    expect(box.top - BELL.bottom).toBeLessThanOrEqual(16);
  });

  it('right-aligns with the bell', () => {
    const box = positionBelow(BELL, DESKTOP);
    expect(box.left + box.width).toBe(BELL.right);
  });

  it('stays fully on screen on desktop', () => {
    expect(onScreen(positionBelow(BELL, DESKTOP))).toBe(true);
  });

  it('never produces a negative left when the trigger is off to one side', () => {
    const box = positionBelow({ right: 30, bottom: 60, top: 20 }, DESKTOP);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(onScreen(box)).toBe(true);
  });

  it('clamps rather than overflowing when the bell is at the very edge', () => {
    const box = positionBelow({ right: 1440, bottom: 64, top: 24 }, DESKTOP);
    expect(onScreen(box)).toBe(true);
  });

  it('keeps the panel on screen on a short viewport', () => {
    const short = { width: 1024, height: 420 };
    const box = positionBelow(BELL, short);
    expect(onScreen(box, short)).toBe(true);
    expect(box.height).toBeGreaterThanOrEqual(0);
  });

  it('caps the height at 680px', () => {
    expect(positionBelow(BELL, { width: 1440, height: 2000 }).height).toBe(680);
  });
});

describe('positionAbove (AI assistant)', () => {
  it('sits directly above the trigger button', () => {
    const box = positionAbove(FAB, DESKTOP);
    // The panel's bottom edge must clear the button's top edge.
    expect(box.top + box.height).toBeLessThanOrEqual(FAB.top);
    expect(FAB.top - (box.top + box.height)).toBeLessThanOrEqual(16);
  });

  it('right-aligns with the button', () => {
    const box = positionAbove(FAB, DESKTOP);
    expect(box.left + box.width).toBe(FAB.right);
  });

  it('stays fully on screen on desktop', () => {
    expect(onScreen(positionAbove(FAB, DESKTOP))).toBe(true);
  });

  it('stays on screen when there is not much room above the button', () => {
    // Button high up the viewport: the panel must shrink, not overflow the top.
    const highFab = { right: 1416, bottom: 120, top: 72 };
    const box = positionAbove(highFab, { width: 1440, height: 900 });
    expect(onScreen(box)).toBe(true);
    expect(box.top).toBeGreaterThanOrEqual(0);
  });

  it('stays on screen on a small phone with safe-area insets', () => {
    const phone = { width: 390, height: 700 };
    const phoneFab = { right: 374, bottom: 660, top: 612 };
    const box = positionAbove(phoneFab, phone);
    expect(onScreen(box, phone)).toBe(true);
  });

  it('never produces a negative left on a narrow viewport', () => {
    const box = positionAbove({ right: 20, bottom: 600, top: 552 }, { width: 320, height: 640 });
    expect(box.left).toBeGreaterThanOrEqual(0);
  });

  it('caps the height so the transcript stays scrollable', () => {
    expect(positionAbove(FAB, { width: 1440, height: 2400 }).height).toBe(640);
  });
});

describe('the two surfaces coexist on a laptop viewport', () => {
  // Both are separate modal dialogs with their own backdrop, so they are never visible at
  // the same time. What matters is that each one, opened on its own, is fully on screen
  // and anchored to its own trigger.
  const laptop = { width: 1280, height: 720 };
  const bell = { right: 1240, bottom: 60, top: 20 };
  const fab = { right: 1256, bottom: 696, top: 648 };

  it('the notification panel alone is on screen below the bell', () => {
    const box = positionBelow(bell, laptop);
    expect(onScreen(box, laptop)).toBe(true);
    expect(box.top).toBeGreaterThanOrEqual(bell.bottom);
  });

  it('the AI panel alone is on screen above the button', () => {
    const box = positionAbove(fab, laptop);
    expect(onScreen(box, laptop)).toBe(true);
    expect(box.top + box.height).toBeLessThanOrEqual(fab.top);
  });
});

describe('triggerBox', () => {
  it('projects only the physical edges the math needs', () => {
    expect(triggerBox({ top: 10, bottom: 58, right: 100, left: 76, width: 24, height: 48 } as DOMRect)).toEqual({
      top: 10,
      bottom: 58,
      right: 100,
    });
  });
});
describe('regression: the centering translate must stay disabled', () => {
  /**
   * `.dialog-pop` centres every dialog with `translate: -50% -50%` — the CSS `translate`
   * property, not `transform`. Both anchored panels position themselves in absolute
   * coordinates, so that centring shifted them by half their own size:
   *
   *   desktop notification: CSS left:872 top:64, painted at x:662 y:-276
   *   mobile notification: painted at x:-195 y:-422 (entirely off-screen)
   *
   * `!translate-x-0` utilities cannot dislodge it, so both components pass an inline
   * `translate: 'none'`. This asserts that inline style is present in both branches.
   */
  // Comments legitimately mention the utility they replaced, so strip them first.
  const readCode = (rel: string) =>
    readFileSync(join(process.cwd(), rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('the notification panel disables translate unconditionally', () => {
    const src = readCode('src/components/notifications/notification-bell.tsx');
    // Not inside a `panelPosition ? ... : undefined` ternary — always applied.
    expect(src).toMatch(/translate:\s*'none'/);
    expect(src).not.toMatch(/panelStyle\s*=\s*panelPosition\s*\?\s*\{/);
  });

  it('the AI panel disables translate unconditionally', () => {
    const src = readCode('src/components/ai/ai-assistant-widget.tsx');
    expect(src).toMatch(/translate:\s*'none'/);
  });

  it('neither panel relies on a utility class to cancel the centering', () => {
    for (const rel of [
      'src/components/notifications/notification-bell.tsx',
      'src/components/ai/ai-assistant-widget.tsx',
    ]) {
      expect(readCode(rel)).not.toMatch(/!translate-x-0/);
    }
  });

  it('the notification panel measures every viewport, with no mobile-only CSS branch', () => {
    const src = readCode('src/components/notifications/notification-bell.tsx');
    expect(src).not.toMatch(/window\.innerWidth\s*<\s*640/);
    // Single measured layout: no full-bleed `w-full` + `left-0 right-0` variant.
    expect(src).not.toMatch(/!w-full/);
  });

  it('both panels size against clientWidth, not innerWidth', () => {
    for (const rel of [
      'src/components/notifications/notification-bell.tsx',
      'src/components/ai/ai-assistant-widget.tsx',
    ]) {
      const src = readCode(rel);
      expect(src).toContain('visibleViewport()');
      expect(src).not.toMatch(/window\.innerWidth/);
      expect(src).not.toMatch(/window\.innerHeight/);
    }
    // innerWidth includes horizontal overflow; clientWidth is the real visible width.
    expect(readFileSync(join(process.cwd(), 'src/lib/overlay-position.ts'), 'utf8')).toMatch(/clientWidth/);
  });
});
