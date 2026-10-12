import { describe, expect, it } from 'vitest';
import { productFormPayload, emptyProductForm, type ProductFormValue } from '../src/app/(admin)/admin/products/product-form';

/**
 * The Arabic payload is the only thing that reaches Arabic visitors.
 *
 * Hotspot copy had no locale support at all, so an Arabic visitor saw English labels pinned onto
 * translated product text; these lock the shape that fixes it.
 */
function base(overrides: Partial<ProductFormValue> = {}): ProductFormValue {
  return { ...emptyProductForm(), ...overrides };
}

const ar = (over: Partial<ProductFormValue['translationsAr']> = {}): ProductFormValue['translationsAr'] => ({
  title: '',
  tagline: '',
  description: '',
  features: '',
  seoTitle: '',
  seoDescription: '',
  hotspots: {},
  ...over,
});

describe('productFormPayload translations', () => {
  it('sends no translations when every Arabic field is blank', () => {
    expect(productFormPayload(base({ title: 'Router' })).translations).toBeNull();
  });

  it('keeps title, tagline, description and bullets', () => {
    const payload = productFormPayload(
      base({
        title: 'Router',
        tagline: 'Fast',
        description: 'A router',
        translationsAr: ar({ title: 'راوتر', tagline: 'سريع', description: 'راوتر', features: 'واحد\nاثنان' }),
      }),
    );
    expect(payload.translations?.ar).toMatchObject({
      title: 'راوتر',
      tagline: 'سريع',
      description: 'راوتر',
      features: ['واحد', 'اثنان'],
    });
  });

  it('drops blank bullet lines rather than storing empty entries', () => {
    const payload = productFormPayload(base({ translationsAr: ar({ title: 'x', features: '  a  \n\n  b  ' }) }));
    expect((payload.translations?.ar as { features?: string[] }).features).toEqual(['a', 'b']);
  });

  it('keys hotspot copy by pin id, not by position', () => {
    const payload = productFormPayload(
      base({
        translationsAr: ar({
          hotspots: {
            p1: { label: 'أول', tooltip: 'تلميح', detail: 'تفصيل' },
            p2: { label: 'ثان', tooltip: '', detail: '' },
          },
        }),
      }),
    );
    expect((payload.translations?.ar as { hotspots?: unknown }).hotspots).toEqual({
      p1: { label: 'أول', tooltip: 'تلميح', detail: 'تفصيل' },
      p2: { label: 'ثان' },
    });
  });

  it('keeps hotspot copy even when the rest of the Arabic is empty', () => {
    const payload = productFormPayload(
      base({ translationsAr: ar({ hotspots: { p1: { label: 'أول', tooltip: '', detail: '' } } }) }),
    );
    expect(payload.translations?.ar).toBeTruthy();
    expect(payload.translations?.ar).toHaveProperty('hotspots');
  });

  it('omits hotspots entirely when every pin is blank', () => {
    const payload = productFormPayload(
      base({ translationsAr: ar({ title: 'x', hotspots: { p1: { label: '', tooltip: '', detail: '' } } }) }),
    );
    expect(payload.translations?.ar).not.toHaveProperty('hotspots');
  });

  it('sends SEO translations when present', () => {
    const payload = productFormPayload(
      base({ translationsAr: ar({ seoTitle: 'عنوان', seoDescription: 'وصف' }) }),
    );
    expect(payload.translations?.ar).toMatchObject({ seoTitle: 'عنوان', seoDescription: 'وصف' });
  });
});
