import { describe, expect, it } from 'vitest';
import { arabicPageLayout, type PageLayout } from '../src/index';

// The live products page's closing button reads "Browse Academies" while the dictionary has
// "Browse academies"; Arabic visitors saw the English label until the lookup ignored case.
describe('Arabic dictionary lookup', () => {
  const layout = (label: string): PageLayout => ({
    root: { props: {} },
    content: [{ type: 'button', props: { id: 'b1', label, href: '/academy' } }],
  });

  it('translates a built-in label whatever its capitalisation', () => {
    expect(arabicPageLayout(layout('Browse Academies')).content[0]!.props!.label).toBe('تصفح الأكاديميات');
    expect(arabicPageLayout(layout('Browse academies')).content[0]!.props!.label).toBe('تصفح الأكاديميات');
  });

  it('leaves text the dictionary does not know untouched', () => {
    expect(arabicPageLayout(layout('Book a demo with Sam')).content[0]!.props!.label).toBe('Book a demo with Sam');
  });
});
