import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards against content that renders but cannot be seen.
 *
 * The storefront went blank because `<Reveal>` — which wraps every top-level block the public
 * renderer emits — writes an inline `opacity: 0` for its `initial="hidden"` state and only
 * clears it when Framer Motion's `whileInView` IntersectionObserver fires. When that callback
 * did not fire, the page was fully present in the DOM and completely invisible:
 *
 *   <main class="flex-1"><div class="min-h-0" style="opacity: 0; transform: none;"></div></main>
 *
 * This is also why it was missed for so long. Verification read the page with `innerText`,
 * which returns text regardless of opacity, so every automated check reported content while
 * the browser showed nothing. Any future check of this must look at computed visibility.
 */
const css = readFileSync(resolve(__dirname, '../src/styles/globals.css'), 'utf8');
const motion = readFileSync(resolve(__dirname, '../src/components/ui/motion.tsx'), 'utf8');

describe('revealed content can never stay invisible', () => {
  it('forces opacity to 1 on a delay, outside the scripting-disabled block', () => {
    expect(css).toContain('animation: motion-reveal-failsafe');
    expect(css).toContain('@keyframes motion-reveal-failsafe');
  });

  it('overrides the inline style framer-motion writes, and holds the end state', () => {
    const keyframes = css.slice(css.indexOf('@keyframes motion-reveal-failsafe'));
    expect(keyframes).toMatch(/opacity:\s*1\s*!important/);
    expect(keyframes).toMatch(/transform:\s*none\s*!important/);
    // `forwards` is what keeps the element visible after the animation ends.
    expect(css).toMatch(/motion-reveal-failsafe[^;]*forwards/);
  });

  it('is not nested inside a scripting: none query, which was the gap', () => {
    // Structural check rather than an index comparison: walk the braces at the failsafe's
    // offset and confirm no enclosing block is a `scripting: none` query.
    const at = css.indexOf('animation: motion-reveal-failsafe');
    expect(at).toBeGreaterThan(-1);
    const stack: string[] = [];
    for (let i = 0; i < at; i++) {
      const c = css[i];
      if (c === '{') stack.push(css.slice(Math.max(0, i - 80), i));
      else if (c === '}') stack.pop();
    }
    const enclosing = stack.join(' | ');
    expect(enclosing).not.toMatch(/@media\s*\(scripting:\s*none\)/);
  });

  it('does not shorten the delay so far that it fights a working reveal', () => {
    const m = css.match(/motion-reveal-failsafe\s+(\d+)ms\s+ease-out\s+(\d+)ms/);
    expect(m).toBeTruthy();
    const [, duration, delay] = m!;
    // Comfortably longer than the reveal transition, so a working reveal is untouched.
    expect(Number(delay)).toBeGreaterThan(800);
    expect(Number(duration)).toBeLessThan(800);
  });

  it('stops shrinking the observer viewport for Reveal, which could block the trigger', () => {
    // Scoped to Reveal: other components in this file use the negative margin deliberately,
    // for content that is meant to animate on scroll rather than for content the page needs.
    const reveal = motion.slice(
      motion.indexOf('export function Reveal'),
      motion.indexOf('export function', motion.indexOf('export function Reveal') + 10),
    );
    expect(reveal).toContain('{ once: inView.once, amount: inView.amount }');
    expect(reveal).not.toContain('inView.margin');
  });

  it('still reveals on scroll, so this is not simply "animation off"', () => {
    expect(motion).toContain('whileInView="visible"');
    expect(motion).toContain('motion-reveal');
  });

  /**
   * The guarantee has to live at the source. A CSS failsafe was tried first and was
   * measurably insufficient: the keyframe was applied and the element still computed to
   * `opacity: 0` four seconds later, because Framer Motion reasserts its own inline value.
   * Asserting `initial={false}` keeps the guarantee attached to the thing that must hold.
   */
  it('never holds content at opacity 0, at the source', () => {
    // Comments are stripped: the note beside the prop explains the fix by naming the value it
    // replaced, and a naive substring match then finds the prose instead of the code.
    const reveal = motion
      .slice(
        motion.indexOf('export function Reveal'),
        motion.indexOf('export function', motion.indexOf('export function Reveal') + 10),
      )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(reveal).toContain('initial={false}');
    expect(reveal).not.toContain('initial="hidden"');
  });
});
