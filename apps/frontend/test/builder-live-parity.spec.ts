import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * The builder and the live site must show the same page, in both languages.
 *
 * Each guard is a cause found on the Arabic products page: an English layout served to Arabic
 * visitors, live sections ignoring the layout's header, hero stats swapped for fixed labels, a
 * canvas inheriting the admin's language, and island previews rendered in the wrong locale.
 */
describe('builder ↔ live parity', () => {
  it('serves every builder page in the visitor\'s language', () => {
    const pages = [
      '(main)/(store)/products/page.tsx',
      '(main)/about/page.tsx',
      '(main)/events/page.tsx',
      '(main)/academy/page.tsx',
      '(main)/(social)/feed/page.tsx',
      '(main)/privacy/page.tsx',
      '(main)/terms/page.tsx',
      '(main)/refunds/page.tsx',
      '(main)/edu-purchases/page.tsx',
      '(public)/page.tsx',
    ];
    for (const page of pages) {
      const source = read(`app/${page}`);
      expect(source, page).toMatch(/resolvePageLayout\(tenantSlug, '[a-z-]+', (locale|await getLocale\(\))\)/);
    }
  });

  it('localizes the built-in layout for Arabic visitors', () => {
    expect(read('lib/builder/theme.ts')).toContain("locale === 'ar' ? arabicPageLayout(fallback) : fallback");
  });

  it('renders the layout\'s own live-section headers in every language', () => {
    const source = read('components/home/live-island-header.tsx');
    const slotFn = source.slice(source.indexOf('export function liveIslandSlot'), source.indexOf('export function liveIslandHeader'));
    expect(slotFn).not.toContain("locale !== 'en'");
  });

  it('renders hero stat blocks on the public page, with live values only', () => {
    expect(read('components/builder/blocks/catalog-hero-block.tsx')).toContain('const renderSlotStats = hasSlotStats;');
  });

  it('gives the canvas its own language, independent of the admin interface', () => {
    const frame = read('components/builder/builder-page-frame.tsx');
    expect(frame).toContain('root.dir = dir');
    expect(frame).toContain('MutationObserver');
    expect(read('components/builder/blocks/live-island-block.tsx')).toContain('&locale=${canvasLocale}');
    expect(read('proxy.ts')).toContain("request.nextUrl.searchParams.get('locale')");
  });

  it('previews Arabic with the same function the server uses', () => {
    expect(read('app/(admin)/admin/builder/builder-editor.tsx')).toContain('arabicPageLayout(english as unknown as PageLayout, arabic)');
  });

  it('applies live data in the builder preview, not only while editing', () => {
    for (const block of ['academy-grid-block', 'partner-logos-block', 'program-cards-block']) {
      expect(read(`components/builder/blocks/${block}.tsx`)).toContain('const live = preview;');
    }
  });

  it('shows admin-written testimonials and hides only the samples', () => {
    const renderer = read('components/home/home-builder.tsx');
    expect(renderer).toContain('isSampleTestimonial(node.props?.quote)');
    expect(renderer).not.toContain("if (node.type === 'testimonials' || node.type === 'testimonial-card') return null;");
  });
});

describe('free-form element block', () => {
  it('is registered for rendering, editing and inserting', () => {
    expect(read('components/builder/blocks/index.tsx')).toContain('element: ElementBlock');
    expect(read('lib/builder/puck-config.tsx')).toContain("Layout: { components: ['stack', 'grid', 'card', 'element'] }");
    expect(read('components/builder/inspector/fields.ts')).toContain("element: { label: 'Element', groups: elementInspector.groups }");
  });

  it('scopes its CSS to the node and never renders an unsafe link or image', () => {
    const block = read('components/builder/blocks/element-block.tsx');
    expect(block).toContain('elementStylesheet(id');
    expect(block).toContain('safeElementHref(href)');
    expect(block).toContain('safeElementSrc(src)');
  });
});
