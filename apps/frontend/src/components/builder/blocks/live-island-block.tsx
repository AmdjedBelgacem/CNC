'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ISLAND_PAD, type LiveIslandProps } from '@titan/shared';
import type { BlockComponentProps } from './index';
import { useCanvasLocale } from '@/components/builder/canvas-locale';
import { Icon } from '@/components/ui/icon';
import { ProductsCatalog } from '@/components/store/products-catalog';
import {
  AboutFactsSection,
  HomeFaqSection,
  HomeGuidesSection,
} from '@/components/home/home-extras';

/**
 * Canvas representation of a live tenant-data island.
 *
 * On the public site `HomeBuilder` replaces this node with the real async server
 * component keyed by `variant`. Puck's canvas is a client tree, so it cannot
 * render those components directly. Rather than keep a second, inevitably
 * drifting copy of every island, this block embeds `/preview/island/<variant>`
 * — the same components and the same public data — in a same-origin iframe and
 * resizes to its measured height.
 *
 * The small badge is the only builder-only chrome. It names the dynamic block
 * and explains what the visitor will see; the rendered section underneath is
 * byte-for-byte the public island.
 */

const ISLAND_COPY: Record<string, { label: string; detail: string; fixed?: boolean }> = {
  'academy-pathways': {
    label: 'Academy pathways',
    detail: 'Live published academies, rendered as the same numbered pathway rows the /academy page uses.',
  },
  'products-featured': {
    label: 'Featured products',
    detail: 'Live published products flagged as featured, taken from the storefront catalog.',
  },
  'products-inventory': {
    label: 'Live inventory',
    detail: 'The full published inventory with category, type, search, and sort controls.',
  },
  'products-departments': {
    label: 'Department index',
    detail: 'Departments derived from the categories of published products.',
  },
  'feed-ticker': {
    label: 'Feed ticker',
    detail: 'Live community posts in the on-air ticker at the top of the feed.',
  },
  'feed-topics': {
    label: 'Feed topics',
    detail: 'A topic index built from the tags on live community posts.',
  },
  'feed-wire': {
    label: 'Community wire',
    detail: 'The public community feed stream, including live posts and reactions.',
  },
  'events-ticker': {
    label: 'Event formats',
    detail: 'Live event formats in the top ticker of the events page.',
  },
  'events-next-up': {
    label: 'Next up',
    detail: 'The next upcoming published events, with dates and seats remaining.',
  },
  'events-schedule': {
    label: 'Event schedule',
    detail: 'The published event schedule grouped by date.',
  },
  'events-browse': {
    label: 'Browse events',
    detail: 'The interactive events board with format filters, upcoming/past toggles, and search.',
  },
  'home-faq': {
    label: 'Homepage FAQ',
    detail: 'Repository-managed FAQ. The same question-and-answer pairs are rendered on the public homepage and described by FAQPage schema.',
    fixed: true,
  },
  'home-guides': {
    label: 'CNC guides',
    detail: 'Repository-managed guide links. Rendered after the homepage FAQ on the public site.',
    fixed: true,
  },
  'about-facts': {
    label: 'About facts',
    detail: 'Repository-managed entity facts. These statements describe the organisation and are not tenant data.',
    fixed: true,
  },
};

/**
 * The public island section owns its top padding; the preview iframe starts at
 * the live rows, so the builder has to reproduce that top padding around the
 * editable header. These must match the section classes in
 * `products-islands`, `feed-islands`, `events-islands` and
 * `academy-pathways`; the preview keeps only the bottom padding.
 */
const SIDE_RAIL_HEADER = new Set(['events-schedule', 'feed-wire']);

const ISLAND_HEADER_WRAPPER: Record<string, string> = {
  'academy-pathways': `px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto ${ISLAND_PAD['academy-pathways'].top}`,
  'products-featured': `px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['products-featured'].top}`,
  'products-inventory': `px-margin-mobile md:px-margin-desktop max-w-[1800px] mx-auto ${ISLAND_PAD['products-inventory'].top}`,
  'products-departments': `px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['products-departments'].top}`,
  'feed-topics': `px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['feed-topics'].top}`,
  'feed-wire': `px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto ${ISLAND_PAD['feed-wire'].top}`,
  'events-next-up': `px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['events-next-up'].top}`,
  'events-schedule': `px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto ${ISLAND_PAD['events-schedule'].top}`,
  'events-browse': `px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['events-browse'].top}`,
};

/** Asks an island preview frame to report its content height (see PreviewHeightReporter). */
function requestIslandHeight(frame: HTMLIFrameElement | null) {
  frame?.contentWindow?.postMessage({ type: 'builder-island-measure' }, window.location.origin);
}

export function LiveIslandBlock({ props, puck }: BlockComponentProps<LiveIslandProps>) {
  const { variant } = props;
  const { locale: canvasLocale } = useCanvasLocale();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const headerNodes = puck.getSlotData?.('header') ?? [];
  const itemNodes = puck.getSlotData?.('items') ?? [];
  const footerNodes = puck.getSlotData?.('footer') ?? [];
  const recordNodes = puck.getSlotData?.('records') ?? [];
  const hasHeader = headerNodes.length > 0;
  const hasItems = itemNodes.length > 0;
  const hasFooter = footerNodes.length > 0;
  const sideRailHeader = SIDE_RAIL_HEADER.has(variant);
  const recordIds = recordNodes
    .map((node) => (typeof node.props?.productId === 'string' ? node.props.productId : ''))
    .filter(Boolean);
  const copy = ISLAND_COPY[variant] ?? {
    label: props.label || variant,
    detail: 'This section is rendered from the same source as the public page.',
    fixed: false,
  };
  const fixed = copy.fixed === true;
  const fixedWidth = variant === 'home-guides' ? 'max-w-5xl' : 'max-w-3xl';

  useEffect(() => {
    setHeight(0);
    setReady(false);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (data?.type !== 'builder-island-height' || typeof data.height !== 'number') return;
      setHeight(Math.max(0, Math.ceil(data.height)));
      setReady(true);
    };

    window.addEventListener('message', onMessage);
    // The frame may have reported before this listener existed; ask it again. Until a report
    // arrives the frame sits at a fallback height, and the canvas no longer matched the page.
    requestIslandHeight(frameRef.current);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [variant]);

  /*
   * A side-rail island's header lives inside the public grid's main column.
   * The iframe reserves that height with a spacer while this editable copy is
   * absolutely positioned over it; measure the copy so the two stay aligned.
   */
  useEffect(() => {
    if (!sideRailHeader || !hasHeader) {
      setHeaderHeight(0);
      return;
    }
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasHeader, sideRailHeader, variant]);

  const empty = ready && height === 0;
  const header = hasHeader ? puck.renderSlot('header') : undefined;
  const items = hasItems ? puck.renderSlot('items') : undefined;
  const footer = hasFooter ? puck.renderSlot('footer') : undefined;

  // The Arabic preview shows the visitor's page, so the editor-only badge stays out of it.
  const badge = canvasLocale === 'ar' ? null : (
    <div className="pointer-events-none absolute end-3 top-3 z-20 flex max-w-[min(22rem,calc(100%-1.5rem))] flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/95 px-2.5 py-1 text-[11px] font-medium text-primary shadow-sm backdrop-blur">
        <Icon name="bolt" className="size-3" />
        {copy.fixed ? 'Fixed' : 'Live'} · {copy.label}
      </span>
      <span className="max-w-[22rem] rounded-lg border border-border/70 bg-background/95 px-2.5 py-1 text-[11px] leading-snug text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
        {copy.detail}
      </span>
    </div>
  );

  /*
   * Fixed islands are ordinary editorial sections. The public routes render
   * these exact components; the canvas must render them too, not a second
   * approximation with its own padding. Only the (absolute) badge is
   * builder-only.
   */
  if (fixed) {
    let content: ReactNode;
    if (variant === 'home-faq') {
      content = <HomeFaqSection header={header} items={items} />;
    } else if (variant === 'home-guides') {
      content = <HomeGuidesSection header={header} />;
    } else if (variant === 'about-facts') {
      content = <AboutFactsSection header={header} items={items} footer={footer} />;
    } else {
      content = (
        <section className={`mx-auto ${fixedWidth} px-4 py-16 sm:px-6 lg:px-8`}>
          {header}
          {items}
          {footer}
        </section>
      );
    }
    return (
      <div data-builder-live-island={variant} className="relative group">
        {badge}
        {content}
      </div>
    );
  }

  /*
   * Public islands that have no data return `null`; the canvas must give them
   * no height either. The badge stays absolute, so the island is still visible
   * in Layers and identifiable on the canvas without shifting the next section.
   */
  if (empty) {
    return (
      <section
        data-builder-live-island={variant}
        data-builder-empty-island="true"
        className="relative group"
      >
        {badge}
      </section>
    );
  }

  return (
    <section data-builder-live-island={variant} className="relative group">
      {badge}

      {hasHeader ? (
        <div
          ref={sideRailHeader ? headerRef : undefined}
          className={
            sideRailHeader
              ? 'island-header-overlay'
              : ISLAND_HEADER_WRAPPER[variant] ??
                'px-margin-mobile md:px-margin-desktop pt-16 md:pt-24'
          }
        >
          {header}
        </div>
      ) : null}

      {variant === 'products-inventory' ? (
        <div className={`px-margin-mobile md:px-margin-desktop ${ISLAND_PAD['products-inventory'].bottom}`}>
          {/* The record blocks hold English copy. In Arabic the live page shows the translated
              storefront cards instead, so the preview does the same. */}
          <ProductsCatalog
            records={canvasLocale === 'en' ? puck.renderSlot('records', { className: 'contents' }) : undefined}
            recordIds={canvasLocale === 'en' ? recordIds : undefined}
            contentLocale={canvasLocale}
            inBuilder
          />
        </div>
      ) : (
        <iframe
          ref={frameRef}
          title={`Live preview: ${copy.label}`}
          src={`/preview/island/${variant}?part=body&locale=${canvasLocale}${
            sideRailHeader ? `&headerHeight=${headerHeight}` : ''
          }`}
          className="pointer-events-none block w-full border-0"
          style={{ height: height || 420 }}
          onLoad={(event) => requestIslandHeight(event.currentTarget)}
          scrolling="no"
          tabIndex={-1}
        />
      )}
    </section>
  );
}
