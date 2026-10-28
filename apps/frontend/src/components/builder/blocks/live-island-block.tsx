'use client';

import { useEffect, useRef, useState } from 'react';
import type { LiveIslandProps } from '@titan/shared';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

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

export function LiveIslandBlock({ props, puck }: BlockComponentProps<LiveIslandProps>) {
  const { variant } = props;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const headerNodes = puck.getSlotData?.('header') ?? [];
  const hasHeader = headerNodes.length > 0;
  const copy = ISLAND_COPY[variant] ?? {
    label: props.label || variant,
    detail: 'This section is rendered from the same source as the public page.',
    fixed: false,
  };

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
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [variant]);

  const empty = ready && height === 0;

  return (
    <section
      data-builder-live-island={variant}
      className="relative group"
    >
      <div className="pointer-events-none absolute end-3 top-3 z-20 flex max-w-[min(22rem,calc(100%-1.5rem))] flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/95 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary shadow-sm backdrop-blur">
          <Icon name="bolt" className="size-3" />
          {copy.fixed ? 'Fixed' : 'Live'} · {copy.label}
        </span>
        <span className="max-w-[22rem] rounded-md bg-background/95 px-2.5 py-1 text-[11px] leading-snug text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
          {copy.detail}
        </span>
      </div>

      {hasHeader ? (
        <div className="px-margin-mobile md:px-margin-desktop pt-12 md:pt-16">
          {puck.renderSlot('header')}
        </div>
      ) : null}

      {empty ? (
        <div className="px-margin-mobile md:px-margin-desktop py-12">
          <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
            <p className="font-semibold text-foreground">No published data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The live site hides this section until there is something to show.
            </p>
          </div>
        </div>
      ) : (
        <iframe
          ref={frameRef}
          title={`Live preview: ${copy.label}`}
          src={`/preview/island/${variant}?part=body`}
          className="pointer-events-none block w-full border-0"
          style={{ height: height || 420 }}
          scrolling="no"
          tabIndex={-1}
        />
      )}
    </section>
  );
}
