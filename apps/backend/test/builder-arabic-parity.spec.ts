import { describe, expect, it, vi } from 'vitest';
import { arabicPageLayout, type PageLayout } from '@titan/shared';
import { PageAutoTranslateService, needsTranslation } from '../src/modules/builder/page-autotranslate.service';

/**
 * The live Arabic page must be what the builder's Arabic preview shows.
 *
 * Arabic visitors used to receive a stored Arabic tree as-is (missing every block added since),
 * or the English layout when no copy existed. Both paths now go through `arabicPageLayout`, and
 * publishing fills in whatever text is still English.
 */
const english = (heading: string, extra: Array<{ type: string; props: Record<string, unknown> }> = []): PageLayout => ({
  root: { props: {} },
  content: [
    {
      type: 'section',
      props: {
        id: 's1',
        content: [{ type: 'heading', props: { id: 'h1', text: heading, as: 'h2' } }, ...extra],
      },
    },
  ],
});

describe('arabic page layout', () => {
  it('takes structure from English and copy from the stored translation', () => {
    const stored = english('عنوان');
    const current = english('Title', [{ type: 'text', props: { id: 't-new', text: 'Added after translating' } }]);
    const merged = arabicPageLayout(current, stored);
    const kids = merged.content[0]!.props!.content as Array<{ props: Record<string, unknown> }>;
    expect(kids.map((kid) => kid.props.id)).toEqual(['h1', 't-new']);
    expect(kids[0]!.props.text).toBe('عنوان');
  });

  it('translates built-in text even when no copy exists', () => {
    const merged = arabicPageLayout(english('How it works'));
    const kids = merged.content[0]!.props!.content as Array<{ props: Record<string, unknown> }>;
    expect(kids[0]!.props.text).toBe('كيف يعمل');
  });
});

describe('what still needs translating', () => {
  it('flags English prose only', () => {
    expect(needsTranslation('Request a quote')).toBe(true);
    expect(needsTranslation('اطلب عرض سعر')).toBe(false);
    expect(needsTranslation('/products')).toBe(false);
    expect(needsTranslation('https://example.com')).toBe(false);
    expect(needsTranslation('42')).toBe(false);
  });
});

describe('publish-time Arabic fill', () => {
  function service(row: Record<string, unknown>) {
    let saved: Record<string, unknown> | undefined;
    const drizzle = {
      db: {
        query: { pages: { findFirst: vi.fn(async () => row) } },
        update: vi.fn(() => ({ set: (value: Record<string, unknown>) => ({ where: async () => { saved = value; } }) })),
      },
    };
    const translateFields = vi.fn(async (_tenant: string, input: { fields: Record<string, string> }) => ({
      translations: Object.fromEntries(Object.keys(input.fields).map((key) => [key, `ع:${input.fields[key]}`])),
    }));
    const svc = new PageAutoTranslateService(drizzle as never, { translateFields } as never);
    return { svc, translateFields, saved: () => saved };
  }

  it('translates only text an admin wrote; built-in text comes from the dictionary', async () => {
    const { svc, translateFields, saved } = service({
      id: 'p1',
      title: 'Showroom',
      layout: english('How it works', [{ type: 'text', props: { id: 't1', text: 'Our custom intro' } }]),
      translations: null,
    });
    const count = await svc.fillArabic('t', 'p1');
    expect(count).toBe(1);
    const sent = translateFields.mock.calls.flatMap((call) => Object.values(call[1].fields));
    expect(sent).toContain('Our custom intro');
    expect(sent).not.toContain('How it works');
    const layout = (saved()!.translations as { ar: { layout: PageLayout } }).ar.layout;
    const kids = layout.content[0]!.props!.content as Array<{ props: Record<string, unknown> }>;
    expect(kids[0]!.props.text).toBe('كيف يعمل');
    expect(kids[1]!.props.text).toBe('ع:Our custom intro');
  });

  it('does nothing when everything is already Arabic', async () => {
    const { svc, translateFields } = service({
      id: 'p1',
      title: 'صفحة',
      layout: english('Title'),
      translations: { ar: { title: 'صفحة', layout: english('عنوان') } },
    });
    expect(await svc.fillArabic('t', 'p1')).toBe(0);
    expect(translateFields).not.toHaveBeenCalled();
  });
});
