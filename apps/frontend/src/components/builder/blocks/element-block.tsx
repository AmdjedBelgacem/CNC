import { createElement, type ReactNode } from 'react';
import Link from 'next/link';
import {
  VOID_ELEMENT_TAGS,
  elementStylesheet,
  sanitizeElementCss,
  safeElementHref,
  safeElementSrc,
  type ElementProps,
} from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';
import { fillCountTokens, isZeroCountToken } from '@/lib/home-metrics';

/**
 * The free-form element: a sanitised HTML tag with its own scoped stylesheet.
 *
 * The rules are written into a `<style>` next to the element, scoped to a class made from the
 * node id, so hover and phone rules work the same in the editor canvas and on the public page
 * (inline styles cannot express either). `sanitizeElementCss` has already removed anything
 * that could leave the rule or load from an arbitrary origin.
 */
const OUT_OF_FLOW = /(?:^|[;{\s])position\s*:\s*(?:absolute|fixed)\b/i;

/** True when the element's own CSS (desktop or phone) positions it out of flow. */
export function isOutOfFlow(css?: unknown, cssMobile?: unknown): boolean {
  return [css, cssMobile].some((rule) => typeof rule === 'string' && OUT_OF_FLOW.test(rule));
}

/** The properties that place a box inside its flex or grid parent, rather than style the box. */
const ITEM_PROPS = new Set([
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-self',
  'justify-self',
  'place-self',
  'order',
  'grid-area',
  'grid-column',
  'grid-column-start',
  'grid-column-end',
  'grid-row',
  'grid-row-start',
  'grid-row-end',
]);

function itemDeclarations(css: unknown): string {
  return sanitizeElementCss(css)
    .split('; ')
    .filter((decl) => ITEM_PROPS.has(decl.slice(0, decl.indexOf(':')).trim()))
    .join('; ');
}

/**
 * Canvas only. The editor wraps each block in a drag wrapper, so the wrapper — not the element —
 * is the flex or grid item of the parent. An element's `flex: 1` or `grid-column: span 2` then
 * did nothing on the canvas (a card's picture area stopped filling the card and its title rose
 * to the top). The wrapper takes the element's item properties and the element fills the
 * wrapper, so the parent lays both out as it lays out the element on the public page.
 */
export function canvasItemRules(className: string, css: unknown, cssMobile: unknown): string {
  const wrapper = `[data-puck-component]:has(> .${className})`;
  const rule = (decls: string) =>
    `${wrapper}{${decls}; display: flex; min-width: 0}${wrapper} > .${className}{flex: 1 1 auto; min-width: 0}`;
  const base = itemDeclarations(css);
  const mobile = itemDeclarations(cssMobile);
  return [base ? rule(base) : '', mobile ? `@media (max-width: 767px){${rule(mobile)}}` : ''].join('');
}

export function ElementBlock({ props, puck }: BlockComponentProps<ElementProps>) {
  const { tag = 'div', text, css, cssHover, cssMobile, href, openInNewTab, src, alt, ariaLabel, className } = props;
  const id = typeof props.id === 'string' ? props.id : 'element';
  // In the builder, `{{academies}}`-style placeholders show the same live counts the public page
  // bakes in on the server, so the canvas matches what visitors see.
  const preview = useBuilderLivePreview();
  const shownText = typeof text === 'string' && preview?.homeMetrics ? fillCountTokens(text, preview.homeMetrics.counts) : text;
  const sheet = elementStylesheet(id, { base: css, hover: cssHover, mobile: cssMobile });
  const style = layoutStyle(props);
  // A stat whose live count is 0 (no published courses yet) is hidden rather than advertised:
  // `globals.css` hides the value's parent element. While editing, the stat stays visible but
  // marked, so the admin can still select and edit it.
  const zeroCount =
    (props as { countZero?: unknown }).countZero === true || isZeroCountToken(text, preview?.homeMetrics?.counts);
  // An element taken out of flow (`position: absolute|fixed`) anchors to its nearest positioned
  // ancestor. On the canvas that is the editor's drag wrapper (inline `position: relative`, 0px
  // tall around an out-of-flow child), so floating cards pinned to `bottom: 0` rose to the top of
  // their section. Marked here, the wrapper is made static (globals.css) and the element anchors
  // to the same ancestor as on the public page.
  const outOfFlow = Boolean(puck.isEditing) && isOutOfFlow(css, cssMobile);
  const common = {
    className: cn(sheet.className, className),
    style,
    'aria-label': ariaLabel || undefined,
    ...(outOfFlow ? { 'data-builder-out-of-flow': '' } : {}),
    ...(zeroCount
      ? puck.isEditing
        ? { 'data-count-zero-editing': '', title: 'Hidden on the live site while this count is 0' }
        : { 'data-count-zero': '' }
      : {}),
  };
  // Out-of-flow elements are not flex or grid items; their wrapper is made static instead.
  const canvasRules = puck.isEditing && !outOfFlow ? canvasItemRules(sheet.className, css, cssMobile) : '';
  const allRules = sheet.rules + canvasRules;
  const styleTag = allRules ? <style dangerouslySetInnerHTML={{ __html: allRules }} /> : null;

  if (VOID_ELEMENT_TAGS.has(tag)) {
    const safeSrc = tag === 'img' ? safeElementSrc(src) : undefined;
    if (tag === 'img' && !safeSrc) return styleTag;
    return (
      <>
        {styleTag}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {tag === 'img' ? <img {...common} src={safeSrc} alt={alt ?? ''} loading="lazy" /> : createElement(tag, common)}
      </>
    );
  }

  const children: ReactNode = (
    <>
      {shownText}
      {puck.renderSlot('content')}
    </>
  );

  if (tag === 'a') {
    const safeHref = safeElementHref(href);
    // Links stay inert in the editor so clicking selects the block instead of navigating.
    if (safeHref && !puck.isEditing) {
      const external = /^https?:/i.test(safeHref);
      if (!external && safeHref.startsWith('/')) {
        return (
          <>
            {styleTag}
            <Link href={safeHref} {...common}>
              {children}
            </Link>
          </>
        );
      }
      return (
        <>
          {styleTag}
          <a
            href={safeHref}
            {...common}
            {...(openInNewTab || external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {children}
          </a>
        </>
      );
    }
    return (
      <>
        {styleTag}
        <span {...common}>{children}</span>
      </>
    );
  }

  return (
    <>
      {styleTag}
      {createElement(tag, common, children)}
    </>
  );
}
