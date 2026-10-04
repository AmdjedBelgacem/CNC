import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/frontend/src');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.turbo'].includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
};

const files = walk(SRC).map((f) => ({ path: relative(ROOT, f), source: readFileSync(f, 'utf8') }));

describe('RTL correctness', () => {
  it('sets lang and dir on the document root', () => {
    const layout = read('apps/frontend/src/app/layout.tsx');
    expect(layout).toMatch(/lang=\{locale\}/);
    expect(layout).toMatch(/dir=\{dir\}/);
  });

  it('derives direction from the locale, not from a hardcoded list at the call site', () => {
    const config = read('apps/frontend/src/i18n/config.ts');
    expect(config).toMatch(/export function dirFor\(locale: Locale\): 'ltr' \| 'rtl'/);
    expect(config).toMatch(/RTL_LOCALES\.includes\(locale\) \? 'rtl' : 'ltr'/);
    expect(config).toMatch(/const RTL_LOCALES: readonly Locale\[\] = \['ar'\]/);
  });

  it('uses logical side utilities instead of physical ones', () => {
    // Physical margins/paddings point at a screen side, so they do not move when
    // the document flips and the layout comes apart.
    const offenders: string[] = [];
    const pattern = /\b(?:ml|mr|pl|pr)-\d/g;
    for (const file of files) {
      if (file.path.includes('analytics-dashboard')) continue;
      for (const match of file.source.matchAll(pattern)) {
        offenders.push(`${file.path}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the centering transform physical, because translate is not mirrored', () => {
    // `left-1/2 -translate-x-1/2` is symmetric and correct in both directions;
    // rewriting it to `start-1/2` would break it.
    const dialog = read('apps/frontend/src/components/ui/dialog.tsx');
    expect(dialog).toMatch(/left-1\/2/);
    expect(dialog).toMatch(/-translate-x-1\/2/);
  });

  it('mirrors horizontal navigation icons', () => {
    const notFlipped: string[] = [];
    const horizontal = /<(ChevronLeft|ChevronRight|ArrowLeft|ArrowRight|CircleChevronLeft|CircleChevronRight)([^>]*?)\/>/g;
    for (const file of files) {
      // Chart arrows encode a trend, not a reading direction.
      if (file.path.includes('analytics-dashboard')) continue;
      for (const match of file.source.matchAll(horizontal)) {
        if (!/flip-rtl|rtl:/.test(match[2] ?? '')) {
          notFlipped.push(`${file.path}: <${match[1]}`);
        }
      }
    }
    expect(notFlipped).toEqual([]);
  });

  it('does not mirror icons that encode a value or a vertical axis', () => {
    // A disclosure chevron points down in both directions.
    const offending: string[] = [];
    for (const file of files) {
      for (const match of file.source.matchAll(/<(ChevronDown|ChevronUp|ArrowUp|ArrowDown)([^>]*?)\/>/g)) {
        if (/flip-rtl/.test(match[2] ?? '')) offending.push(`${file.path}: <${match[1]}`);
      }
    }
    expect(offending).toEqual([]);
  });

  it('pins a code block to ltr so mixed Latin snippets stay readable', () => {
    // A code sample is a foreign-language island: inside an RTL paragraph it
    // keeps its own direction so indentation and punctuation stay readable.
    const offenders: string[] = [];
    for (const file of files) {
      if (!/<pre/.test(file.source)) continue;
      for (const match of file.source.matchAll(/<pre([^>]*)>/g)) {
        const attrs = match[1] ?? '';
        if (!/dir="ltr"/.test(attrs) && !/className="[^"]*\bcode-block\b/.test(attrs)) {
          offenders.push(file.path);
        }
      }
    }
    expect(offenders).toEqual([]);
    const markdown = read('apps/frontend/src/components/ai/ai-markdown.tsx');
    expect(markdown).toMatch(/<pre[\s\S]{0,80}dir="ltr"/);
  });

  it('aligns the language switcher to the start edge', () => {
    // A locale control on the right in LTR belongs on the left in RTL.
    const nav = read('apps/frontend/src/components/layout/nav-main.tsx');
    expect(nav).not.toMatch(/\b(?:ml|mr)-/);
  });
});

describe('locale resolution', () => {
  const request = read('apps/frontend/src/i18n/request.ts');

  it('lets an explicit cookie choice win over the browser header', () => {
    // Cookie first; Accept-Language only fills in when no cookie is set.
    expect(request).toMatch(/let locale = coerceLocale\(cookieValue\)/);
    expect(request).toMatch(/if \(!cookieValue\) \{[\s\S]{0,160}localeFromAcceptLanguage/);
  });

  it('falls back to English text, not to a dotted key', () => {
    // The dotted-key fallback renders `admin.staff.saveRoles` at the user.
    expect(request).toMatch(/getMessageFallback/);
    expect(request).toMatch(/typeof value === 'string' && value\.length > 0 \? value/);
  });

  it('loads the English catalog to service that fallback', () => {
    expect(request).toMatch(/fallbackMessages/);
  });
});
