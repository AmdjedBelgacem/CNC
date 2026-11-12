import { describe, expect, it } from 'vitest';
import { elementStylesheet, safeElementHref, safeElementSrc, sanitizeElementCss } from '../src/blocks/element-css';
import { validatePageLayout } from '../src/validators/page';

describe('free-form element CSS', () => {
  it('keeps ordinary declarations and normalises camelCase', () => {
    expect(sanitizeElementCss('display:flex; gridTemplateColumns: 1fr 2fr; --accent: #f00')).toBe(
      'display: flex; grid-template-columns: 1fr 2fr; --accent: #f00',
    );
  });

  it('drops anything that could escape the rule or run code', () => {
    expect(sanitizeElementCss('color: red} body{display:none')).toBe('');
    expect(sanitizeElementCss('width: expression(alert(1))')).toBe('');
    expect(sanitizeElementCss('background: url(javascript:alert(1))')).toBe('');
    expect(sanitizeElementCss('background: url(http://evil.test/x.png)')).toBe('');
    expect(sanitizeElementCss('color: red </style><script>')).toBe('');
    expect(sanitizeElementCss('behavior: url(x.htc); color: blue')).toBe('color: blue');
  });

  it('allows https and inline images in url()', () => {
    expect(sanitizeElementCss('background-image: url(https://cdn.example.com/a.png)')).toContain('https://cdn.example.com/a.png');
  });

  it('scopes rules to a class made from the node id', () => {
    const sheet = elementStylesheet('a"b{c', { base: 'color: red', hover: 'opacity: .8', mobile: 'display: block' });
    expect(sheet.className).toBe('tel-abc');
    expect(sheet.rules).toBe('.tel-abc{color: red}.tel-abc:hover{opacity: .8}@media (max-width: 767px){.tel-abc{display: block}}');
  });

  it('only renders safe links and images', () => {
    expect(safeElementHref('javascript:alert(1)')).toBeUndefined();
    expect(safeElementHref('/courses')).toBe('/courses');
    expect(safeElementSrc('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(safeElementSrc('http://x.test/a.png')).toBeUndefined();
  });

  it('validates as a block with nested children', () => {
    const result = validatePageLayout({
      root: { props: {} },
      content: [
        { type: 'element', props: { id: 'e1', tag: 'ul', css: 'display:grid', content: [{ type: 'element', props: { id: 'e2', tag: 'li', text: 'One' } }] } },
      ],
    });
    expect(result.ok).toBe(true);
    expect(validatePageLayout({ root: { props: {} }, content: [{ type: 'element', props: { tag: 'script' } }] }).ok).toBe(false);
  });
});
