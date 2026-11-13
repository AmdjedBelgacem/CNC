import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PuckNode } from '@titan/shared';
import { BuilderNode } from '../src/components/builder/block-renderer';

/**
 * The shape the production AI builder returned when asked for a comparison table, which is
 * not in the block list: free `element` nodes nested inside a section. The public renderer
 * must turn them into a real table, so a new element the AI invents reaches visitors.
 */
const el = (tag: string, props: Record<string, unknown> = {}, content: PuckNode[] = []): PuckNode => ({
  type: 'element',
  props: { id: `${tag}-${Math.random().toString(36).slice(2, 8)}`, tag, ...props, ...(content.length ? { content } : {}) },
});

const aiSection: PuckNode = {
  type: 'section',
  props: {
    id: 'ai-compare',
    bg: 'muted',
    content: [
      el('div', { css: 'width: 100%; overflow-x: auto' }, [
        el('table', { css: 'width: 100%; border-collapse: collapse', ariaLabel: 'مقارنة بين الليزر الليفي والبلازما' }, [
          el('thead', {}, [el('tr', {}, [el('th', { text: 'المعيار' }), el('th', { text: 'الليزر الليفي' }), el('th', { text: 'البلازما' })])]),
          el('tbody', {}, [
            el('tr', {}, [el('td', { text: 'جودة القطع' }), el('td', { text: 'حافة نظيفة' }), el('td', { text: 'حافة أوسع' })]),
            el('tr', {}, [el('td', { text: 'أقصى سماكة' }), el('td', { text: '٢٠–٢٥ مم' }), el('td', { text: '٤٠–٥٠ مم' })]),
          ]),
        ]),
      ]),
    ],
  },
};

describe('an element the AI invented', () => {
  it('renders as a real table on the public page', () => {
    const html = renderToStaticMarkup(<BuilderNode node={aiSection} zones={{}} />);
    expect(html).toMatch(/<table[^>]*aria-label="مقارنة بين الليزر الليفي والبلازما"/);
    expect(html).toMatch(/<thead[^>]*>\s*<tr[^>]*>\s*<th[^>]*>المعيار<\/th>/);
    expect((html.match(/<td/g) ?? []).length).toBe(6);
    expect(html).toContain('٤٠–٥٠ مم');
  });
});
