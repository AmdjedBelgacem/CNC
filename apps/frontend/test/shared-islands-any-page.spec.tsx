import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import type { PageLayout } from '@titan/shared';
import messages from '../messages/ar.json';
import { HomeBuilder } from '../src/components/home/home-builder';

/**
 * The FAQ an admin placed on the products page showed in the builder but never on the live
 * page: that route only mapped its own product islands, and an unmapped island renders nothing.
 * Content-only islands now render on any page without the route wiring them up.
 */
function render(layout: PageLayout) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="ar" messages={messages} timeZone="UTC">
      <HomeBuilder layout={layout} islands={{}} />
    </NextIntlClientProvider>,
  );
}

describe('content-only islands on any page', () => {
  it('renders the FAQ and guides on a page that does not map them', () => {
    const html = render({
      root: { props: {} },
      content: [
        { type: 'live-island', props: { id: 'faq', variant: 'home-faq' } },
        { type: 'live-island', props: { id: 'guides', variant: 'home-guides' } },
      ],
    } as unknown as PageLayout);
    expect(html).toContain('أسئلة شائعة');
    expect(html).toContain('حلول CNC والتدريب والأدلة العملية');
  });

  it('still hides an island that needs page data the route did not provide', () => {
    const html = render({
      root: { props: {} },
      content: [{ type: 'live-island', props: { id: 'inv', variant: 'products-inventory' } }],
    } as unknown as PageLayout);
    expect(html).toBe('<div></div>');
  });
});
