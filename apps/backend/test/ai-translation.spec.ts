import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

/**
 * Field validation.
 *
 * The DTO originally carried `@Matches(/^[^{}]*$/)` on `fields`, on the theory that it would
 * reject a nested object. `@Matches` only accepts a string, so it failed on *every* request —
 * including a perfectly valid one — and the endpoint rejected all translation with "fields must
 * be a flat object of strings" before the service was ever reached.
 */

/** The normalisation the service performs, without needing a configured AI provider. */
function normalise(fields: Record<string, unknown>) {
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string') throw new BadRequestException(`Field "${key}" must be a string`);
  }
  return Object.entries(fields)
    .map(([key, value]) => [key, (value as string).trim()] as [string, string])
    .filter(([, value]) => value.length > 0);
}

describe('translation field validation', () => {
  it('accepts a flat object of strings', () => {
    expect(normalise({ Title: 'CNC', Tagline: 'Precision' })).toEqual([
      ['Title', 'CNC'],
      ['Tagline', 'Precision'],
    ]);
  });

  it('trims and drops blanks rather than sending empty strings to the model', () => {
    expect(normalise({ A: '  x  ', B: '', C: '   ' })).toEqual([['A', 'x']]);
  });

  it('names the offending field when a value is not a string', () => {
    expect(() => normalise({ Title: 'ok', Nested: { a: 1 } })).toThrow(/Field "Nested"/);
  });

  it('rejects arrays and numbers as values', () => {
    expect(() => normalise({ A: ['x'] })).toThrow(/must be a string/);
    expect(() => normalise({ A: 5 })).toThrow(/must be a string/);
  });

  it('the DTO does not use @Matches anywhere', () => {
    // The regression that broke every request. `@Matches` only accepts a string, so putting it
    // on an object property rejects all input — including valid input — before the service runs.
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../src/modules/ai/dto/translate.dto.ts'),
      'utf8',
    );
    // Strip comments: the doc block explains this mistake and names it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/@Matches/);
    expect(src).toMatch(/@IsObject/);
    expect(src).toMatch(/fields: Record<string, unknown>/);
  });
});

describe('translation result parsing', () => {
  const keys = ['Title', 'Tagline'];
  // Mirrors the service, including the balanced-object extraction that the prose case needs.
  const firstBalancedObject = (input: string): string | null => {
    const start = input.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inString = false, escaped = false;
    for (let i = start; i < input.length; i += 1) {
      const ch = input[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) return input.slice(start, i + 1); }
    }
    return null;
  };
  const parse = (raw: string) => {
    const candidates = [firstBalancedObject(raw), raw, ...[...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1] ?? '')];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const out: Record<string, string> = {};
        for (const k of keys) {
          const v = (parsed as Record<string, unknown>)[k];
          if (typeof v === 'string' && v.trim()) out[k] = v.trim();
        }
        if (Object.keys(out).length) return out;
      } catch {
        /* next candidate */
      }
    }
    return null;
  };

  it('reads clean JSON', () => {
    expect(parse('{"Title":"عنوان","Tagline":"شعار"}')).toEqual({ Title: 'عنوان', Tagline: 'شعار' });
  });

  it('reads JSON wrapped in a markdown fence', () => {
    expect(parse('```json\n{"Title":"عنوان"}\n```')).toEqual({ Title: 'عنوان' });
  });

  it('reads JSON surrounded by prose', () => {
    expect(parse('Sure! {"Title":"عنوان","Tagline":"شعار"} Hope that helps.')).toEqual({
      Title: 'عنوان',
      Tagline: 'شعار',
    });
  });

  it('ignores braces inside string values', () => {
    expect(parse('{"Title":"عنوان {ه}","Tagline":"x"}')).toEqual({ Title: 'عنوان {ه}', Tagline: 'x' });
  });

  it('returns null when nothing usable came back', () => {
    expect(parse('I could not translate that.')).toBeNull();
  });
});
