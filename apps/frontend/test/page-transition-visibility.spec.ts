import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The wrapper around the entire page must never be able to become invisible.
 *
 * The reported DOM identified this element precisely:
 *
 *   <main class="flex-1"><div class="min-h-0" style="opacity: 0; transform: none;"></div></main>
 *
 * `transform: none` alongside `opacity: 0` is the tell: the `y: 0` end value had resolved while
 * the opacity had not, so Framer Motion's transition applied only halfway and left the whole
 * page transparent. With `AnimatePresence mode="wait"`, a page stuck in its exit also blocks
 * the next route — which is why a refresh was the only escape.
 *
 * Note this is a *different* component from `<Reveal>`, which had the same failure mode for
 * below-the-fold blocks. Two separate motion wrappers, one shared blind spot in testing.
 */
const src = readFileSync(resolve(__dirname, '../src/components/ui/page-transition.tsx'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('PageTransition', () => {
  it('wraps the page inside main, which is why a stuck animation blanks the site', () => {
    expect(src).toContain("'min-h-0'");
  });

  it('never starts the page at opacity 0', () => {
    expect(src).toContain('initial={{ opacity: 1');
    expect(src).not.toMatch(/initial=\{\{[^}]*opacity:\s*0/);
  });

  it('never fades the page out on exit, which mode="wait" would block on', () => {
    expect(src).not.toMatch(/exit=\{\{[^}]*opacity:\s*0/);
    expect(src).toContain('exit={{ opacity: 1');
  });

  it('keeps the movement, so navigation still reads as a transition', () => {
    expect(src).toContain('y: 10 * direction');
    expect(src).toContain('animate={{ opacity: 1, y: 0');
  });
});
