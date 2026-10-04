import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../..', import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(ROOT, 'apps/frontend', rel), 'utf8');

/**
 * Hooks must not sit below a conditional return.
 *
 * `SmartInspector` had `useInspectorText()` after `if (!selected) return` and
 * `if (!def) return`. Selecting a block therefore added a hook and deselecting
 * removed one, which React reports as "the order of Hooks changed" and which also
 * left the intl provider unreachable on the short-circuit path.
 *
 * A naive line scan gives false positives — `return useQuery(...)` is the whole
 * body of most custom hooks here — so this walks a single function body with brace
 * matching and only flags a hook that appears after a `return` at the same nesting
 * depth as the hook.
 */
function findConditionalHookCalls(source: string): Array<{ fn: string; hook: string; line: number }> {
  const findings: Array<{ fn: string; hook: string; line: number }> = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const signature = lines[i]!.match(/^\s*(?:export\s+)?function\s+(\w+)\s*\(/);
    if (!signature) continue;
    const name = signature[1]!;
    // A custom hook may legitimately return a hook call: that is the whole body,
    // not a conditional.
    if (/^use[A-Z]/.test(name)) continue;

    // Braces on the signature line itself matter: a destructured parameter
    // (`function W({ a }: Props)`) contains an unbalanced `{`.
    let depth = 0;
    let opened = false;
    for (const ch of lines[i]!.replace(/\/\/.*$/, '')) {
      if (ch === '{') { depth += 1; opened = true; }
      else if (ch === '}') depth -= 1;
    }
    let conditionalReturnDepth: number | null = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const raw = lines[j]!;
      // Strip block comments and line comments so commented-out code is ignored.
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '');
      if (!code.trim() && !opened) continue;

      for (const ch of code) {
        if (ch === '{') { depth += 1; opened = true; }
        else if (ch === '}') depth -= 1;
      }
      if (!opened) continue;

      // A `return` that sits directly in the component body (depth 1), not inside
      // a nested callback or an if-block, is an early exit for the whole component.
      const returnsHere =
        /^\s*(?:if\s*\([^)]*\)\s*)?return[\s(]/.test(code) &&
        depth === 1 &&
        !/\breturn\s*$/.test(code.trim());
      if (returnsHere && conditionalReturnDepth === null) conditionalReturnDepth = 1;

      if (conditionalReturnDepth === 1) {
        const hook = code.match(/\b(use[A-Z]\w*)\s*\(/);
        if (hook && !/^\s*export function use/.test(code)) {
          findings.push({ fn: name, hook: hook[1]!, line: j + 1 });
        }
      }

      if (depth <= 0 && opened) break;
    }
  }
  return findings;
}

describe('hooks are not called conditionally', () => {
  const inspectorFiles = [
    'src/components/builder/inspector/smart-inspector.tsx',
    'src/components/builder/inspector/controls.tsx',
    'src/components/builder/node-inspector.tsx',
  ];

  for (const file of inspectorFiles) {
    it(`${file.split('/').pop()} calls every hook before any early return`, () => {
      const findings = findConditionalHookCalls(read(file));
      expect(
        findings.map((f) => `${f.fn}() calls ${f.hook}() at line ${f.line}, after an early return`),
      ).toEqual([]);
    });
  }

  it('reports the shape it is meant to catch', () => {
    // The scanner must actually detect the bug, otherwise passing it is meaningless.
    const broken = `
      export function Widget({ selected }: { selected: string | null }) {
        const [open, setOpen] = useState(false);
        if (!selected) return null;
        const text = useTranslator();
        return <div>{text}</div>;
      }
    `;
    expect(findConditionalHookCalls(broken)).toEqual([
      { fn: 'Widget', hook: 'useTranslator', line: 5 },
    ]);
  });

  it('does not flag a custom hook that simply returns a hook call', () => {
    const fine = `
      export function useMyThing() {
        return useQuery({ queryKey: ['x'] });
      }
      export function useOther() {
        const q = useQuery({ queryKey: ['y'] });
        if (!q.data) return null;
        return q;
      }
    `;
    // The first is exempt as a custom hook; the second only calls useQuery first.
    expect(findConditionalHookCalls(fine)).toEqual([]);
  });
});

describe('SmartInspector hook order', () => {
  const source = read('src/components/builder/inspector/smart-inspector.tsx');
  // Strip comments first. The comment explaining this bug quotes both strings the
  // assertions below search for, so a naive search finds the prose first.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const body = code.slice(code.indexOf('export function SmartInspector'));
  // Anchor on the declaration: the comment above it names the hook too.
  const hookAt = body.indexOf('const groupText = useInspectorText();');
  const earlyReturn = body.indexOf('if (!selected) return');

  it('calls useInspectorText above the no-selection early return', () => {
    expect(hookAt).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(hookAt, 'the hook must be declared before the early return').toBeLessThan(earlyReturn);
  });

  it('resolves the intl catalogue for the block label through the hook', () => {
    // The label used to fall back to the raw block type; it must go through the
    // catalogue now that the hook always runs.
    expect(source).toMatch(/groupText\.label\(undefined, def\.label \?\? selected\.type\)/);
  });
});
