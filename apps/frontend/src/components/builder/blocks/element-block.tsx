import { createElement, type ReactNode } from 'react';
import Link from 'next/link';
import {
  VOID_ELEMENT_TAGS,
  elementStylesheet,
  safeElementHref,
  safeElementSrc,
  type ElementProps,
} from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/**
 * The free-form element: a sanitised HTML tag with its own scoped stylesheet.
 *
 * The rules are written into a `<style>` next to the element, scoped to a class made from the
 * node id, so hover and phone rules work the same in the editor canvas and on the public page
 * (inline styles cannot express either). `sanitizeElementCss` has already removed anything
 * that could leave the rule or load from an arbitrary origin.
 */
export function ElementBlock({ props, puck }: BlockComponentProps<ElementProps>) {
  const { tag = 'div', text, css, cssHover, cssMobile, href, openInNewTab, src, alt, ariaLabel, className } = props;
  const id = typeof props.id === 'string' ? props.id : 'element';
  const sheet = elementStylesheet(id, { base: css, hover: cssHover, mobile: cssMobile });
  const style = layoutStyle(props);
  const common = {
    className: cn(sheet.className, className),
    style,
    'aria-label': ariaLabel || undefined,
  };
  const styleTag = sheet.rules ? <style dangerouslySetInnerHTML={{ __html: sheet.rules }} /> : null;

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
      {text}
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
