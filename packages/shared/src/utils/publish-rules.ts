import type { PageLayout, PuckNode } from '../types/page';
import { walkLayoutNodes } from '../blocks/slots';

/**
 * Rules for "is this page safe to publish?".
 *
 * Pure and in shared, not in the editor component, because they are domain rules
 * rather than UI: the same list can gate a publish button, annotate a page list,
 * or warn in a CI check, and none of those should re-implement it.
 *
 * Issues carry a message *key* rather than text. Translation is the caller's job,
 * which keeps this file free of any i18n concern and lets the same rule be
 * rendered in English or Arabic without duplicating the logic.
 */

export type PublishIssueLevel = 'error' | 'warning';

export interface PublishIssue {
  /** Stable identifier, also used as a React key. */
  id: string;
  level: PublishIssueLevel;
  /** Dotted key under `builder.publish`, without the namespace. */
  messageKey: string;
  /** Interpolation values for the message. */
  values?: Record<string, string | number>;
}

export interface PagePublishFacts {
  title?: string | null;
  slug?: string | null;
  status?: string | null;
  isSystem?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/**
 * The prop that marks a node hidden.
 *
 * `BuilderNode` on the public path drops a node whose `visible` prop is `false`.
 * This constant and that check have to agree: when they disagreed, the hide
 * button wrote a marker nothing read, so the block stayed on the live site while
 * the editor showed it as hidden.
 */
export const HIDDEN_PROP = 'visible';

export function isNodeHidden(node: PuckNode): boolean {
  return node.props?.[HIDDEN_PROP] === false;
}

/**
 * Prop names that are styling or configuration rather than content, so a block
 * carrying only these does not count as an empty block.
 */
const NON_CONTENT_PROPS =
  /^(id|className|src|href|url|image|icon|iconPosition|variant|size|align|as|direction|directionMobile|gap|align|justify|wrap|columns|order|padding|bg|radius|border|shadow|hover|accent|width|question|items|overlap|columnsMobile|columnsSm|columnsLg|buttonPadding.*|answerPadding.*|visible)$/i;

/** True when a block has at least one piece of author-written text. */
function hasContent(node: PuckNode): boolean {
  return Object.entries(node.props ?? {}).some(
    ([key, value]) =>
      typeof value === 'string' && value.trim().length > 0 && !NON_CONTENT_PROPS.test(key),
  );
}

export function collectPublishIssues(
  page: PagePublishFacts | null | undefined,
  layout: PageLayout | null | undefined,
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (!page) return issues;

  if (!page.title?.trim()) {
    issues.push({ id: 'title', level: 'error', messageKey: 'issue.noTitle' });
  }
  if (!page.slug?.trim()) {
    issues.push({ id: 'slug', level: 'error', messageKey: 'issue.noSlug' });
  }

  const nodes = layout?.content ?? [];
  if (nodes.length === 0) {
    // A warning, not an error: an empty page is a legitimate starting point, and
    // blocking a publish over it would just push authors to publish around it.
    issues.push({ id: 'empty', level: 'warning', messageKey: 'issue.emptyPage' });
  }

  let visible = 0;
  let hidden = 0;
  let noText = 0;
  if (layout) {
    walkLayoutNodes(layout, (node) => {
      if (isNodeHidden(node)) {
        hidden += 1;
        return;
      }
      visible += 1;
      if (!hasContent(node)) noText += 1;
    });
  }

  if (visible === 0 && hidden > 0) {
    // Every block hidden means the page renders blank. That is an error, not a
    // warning: the page exists, is reachable, and shows nothing.
    issues.push({
      id: 'allHidden',
      level: 'error',
      messageKey: 'issue.allHidden',
      values: { count: hidden },
    });
  } else if (hidden > 0) {
    issues.push({
      id: 'hidden',
      level: 'warning',
      messageKey: 'issue.hasHidden',
      values: { count: hidden },
    });
  }
  if (noText > 0 && visible > 0) {
    issues.push({
      id: 'noText',
      level: 'warning',
      messageKey: 'issue.emptyBlocks',
      values: { count: noText },
    });
  }

  if (page.status === 'disabled') {
    issues.push({ id: 'disabled', level: 'warning', messageKey: 'issue.disabled' });
  }
  if (!page.seoDescription) {
    issues.push({ id: 'seo', level: 'warning', messageKey: 'issue.noSeo' });
  }
  if (page.isSystem && !page.slug) {
    issues.push({ id: 'system', level: 'error', messageKey: 'issue.systemBroken' });
  }

  return issues;
}
