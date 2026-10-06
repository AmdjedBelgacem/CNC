/**
 * Admin custom email system — shared structural types.
 *
 * Deliberately a sibling of the Puck page layout types and NOT a reuse of them.
 * A page layout compiles to `<div>` + flex and relies on a stylesheet; an email
 * must compile to table-based HTML with every style inline, because Gmail strips
 * `<style>` and Outlook's Word engine ignores `display:flex`. Sharing the block
 * model would guarantee one of the two renderers is wrong.
 *
 * These types are the single representation used by the backend compiler, the
 * admin editor, and the preview/send path. Kept dependency-free on purpose.
 */

export type EmailCategory = 'auth' | 'learning' | 'commerce' | 'community' | 'system' | 'custom';

export type EmailTemplateStatus = 'draft' | 'published' | 'archived';

export type EmailTextAlign = 'left' | 'center' | 'right';

export interface EmailBlockBase {
  /** Stable within a layout; used as the React key and for reorder/selection. */
  id: string;
}

export interface EmailHeadingBlock extends EmailBlockBase {
  type: 'heading';
  props: {
    /** Rendered with `{{…}}` variables. */
    text: string;
    level: 1 | 2 | 3;
    align: EmailTextAlign;
    color: string;
  };
}

/**
 * Only inline tags are allowed: b, i, u, a, span, br. The compiler escapes
 * anything else it finds, so a template author cannot smuggle layout into text.
 */
export interface EmailTextBlock extends EmailBlockBase {
  type: 'text';
  props: {
    html: string;
    align: EmailTextAlign;
    color: string;
    fontSize: number;
    lineHeight: number;
    /** Rendered above the copy, e.g. "ORDER CONFIRMED". */
    label?: string;
  };
}

export interface EmailButtonBlock extends EmailBlockBase {
  type: 'button';
  props: {
    label: string;
    /** Must be an absolute https URL supplied by the server payload. */
    url: string;
    align: EmailTextAlign;
    variant: 'primary' | 'secondary' | 'link';
  };
}

export interface EmailImageBlock extends EmailBlockBase {
  type: 'image';
  props: {
    url: string;
    /** Non-empty: most clients block images and fall back to this text. */
    alt: string;
    width: number;
    height: number;
    align: EmailTextAlign;
  };
}

export interface EmailSpacerBlock extends EmailBlockBase {
  type: 'spacer';
  props: { height: number };
}

export interface EmailDividerBlock extends EmailBlockBase {
  type: 'divider';
  props: { color: string };
}

/**
 * Renders a table from a payload path. `source` is a variable path such as
 * `order.items`; the compiler expands it per-send, which is why a data table
 * cannot be pre-rendered into static HTML at publish time.
 */
export interface EmailDataTableBlock extends EmailBlockBase {
  type: 'data-table';
  props: {
    source: string;
    mode: 'keyvalue' | 'columns';
    /** keyvalue mode only: the path each row's label is read from. */
    labelKey?: string;
    valueKey?: string;
    /** columns mode: fixed headers, values read from each row by key. */
    columns: Array<{ key: string; label: string; align?: EmailTextAlign }>;
    align: EmailTextAlign;
  };
}

export interface EmailColumnsBlock extends EmailBlockBase {
  type: 'columns';
  props: {
    columns: Array<{ width: number; blocks: EmailBlock[] }>;
  };
}

export interface EmailFooterBlock extends EmailBlockBase {
  type: 'footer';
  props: {
    /** Shown above the legal line. Keep it: it is the fallback when images are blocked. */
    text?: string;
    showUnsubscribe: boolean;
    /** Variable path, not a literal, so it can be a signed single-use URL. */
    unsubscribeUrlPath?: string;
  };
}

/**
 * P1. Sanitized on save AND on render against an allowlist. Cannot contain
 * script, forms, iframes, event handlers or `data:` URIs.
 */
export interface EmailRawHtmlBlock extends EmailBlockBase {
  type: 'raw-html';
  props: { html: string };
}

export type EmailBlock =
  | EmailHeadingBlock
  | EmailTextBlock
  | EmailButtonBlock
  | EmailImageBlock
  | EmailSpacerBlock
  | EmailDividerBlock
  | EmailDataTableBlock
  | EmailColumnsBlock
  | EmailFooterBlock
  | EmailRawHtmlBlock;

export type EmailBlockType = EmailBlock['type'];

export interface EmailLayout {
  /** HTML direction. RTL flips alignment and sets `dir` on the root table. */
  direction: 'ltr' | 'rtl';
  /** Container background, set on the outermost table. */
  backgroundColor: string;
  contentBackgroundColor: string;
  /** Centre-strip width in px. 600 is the near-universal safe maximum. */
  contentWidth: number;
  blocks: EmailBlock[];
  /**
   * Bumped when the compiler's output for the same layout changes shape. Stored
   * on each published version so a re-render that disagrees with the reviewed
   * artifact is detectable rather than silent.
   */
  schemaVersion: number;
}

export type EmailVariableType =
  | 'string'
  | 'number'
  | 'money'
  | 'date'
  | 'url'
  | 'boolean'
  | 'image_url'
  | 'enum';

/**
 * The closed contract for one variable. `path` must be resolvable against the
 * trigger's payload; the renderer refuses anything not declared here, so a
 * template can never read a field the trigger did not intend to expose.
 */
export interface EmailVariableDef {
  path: string;
  type: EmailVariableType;
  required: boolean;
  label: string;
  example: string;
  enumValues?: string[];
  maxLength?: number;
}

export interface EmailTemplateSummary {
  id: string;
  tenantId: string | null;
  slug: string;
  name: string;
  category: EmailCategory;
  status: EmailTemplateStatus;
  isSystem: boolean;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
  subjectTemplate: string;
  preheaderTemplate: string | null;
  layout: EmailLayout;
  variableSchema: EmailVariableDef[];
}

export interface EmailRenderResult {
  html: string;
  text: string;
  subject: string;
  preheader: string | null;
}

/** Built-in category order for the admin sidebar. */
export const EMAIL_CATEGORY_ORDER: EmailCategory[] = [
  'auth',
  'learning',
  'commerce',
  'community',
  'system',
  'custom',
];

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  auth: 'Auth',
  learning: 'Learning',
  commerce: 'Commerce',
  community: 'Community',
  system: 'System',
  custom: 'Custom',
};