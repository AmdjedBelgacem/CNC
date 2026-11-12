/**
 * CSS for the free-form `element` block.
 *
 * The element block is how the AI builder (and an author) creates something no designed block
 * covers: any of a fixed set of HTML tags with its own declarations. The declarations are plain
 * text, so they are sanitised here — once, in the shared package — and the backend validator,
 * the editor canvas and the public renderer all apply the same rules. Nothing that can execute,
 * load from an arbitrary origin or break out of its own rule survives.
 */

export const ELEMENT_TAGS = [
  'div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'figure', 'figcaption',
  'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'strong', 'em', 'blockquote', 'code', 'pre',
  'ul', 'ol', 'li', 'a', 'img', 'hr', 'label',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
] as const;
export type ElementTag = (typeof ELEMENT_TAGS)[number];

/** Tags that cannot hold children or text. */
export const VOID_ELEMENT_TAGS: ReadonlySet<string> = new Set(['img', 'hr']);

const MAX_DECLARATIONS = 60;
const MAX_VALUE = 400;

/** Properties that can reach outside the element or load content on their own. */
const BLOCKED_PROPERTIES = new Set(['behavior', '-moz-binding', 'content-visibility']);

function safeUrl(raw: string): boolean {
  const url = raw.trim().replace(/^['"]|['"]$/g, '');
  return /^https:\/\//i.test(url) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(url) || url.startsWith('/');
}

/**
 * Normalises "prop: value; prop: value" text into safe declarations.
 *
 * Accepts kebab-case or camelCase property names and custom properties (`--x`). Drops a
 * declaration whose value contains anything that could end the rule (`{`, `}`, `<`), any
 * `expression(`/`javascript:`/`@import`, or a `url()` that is not https, root-relative or an
 * inline image. Returns "" when nothing is left.
 */
export function sanitizeElementCss(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) return '';
  const out: string[] = [];
  for (const chunk of input.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    if (out.length >= MAX_DECLARATIONS) break;
    const colon = chunk.indexOf(':');
    if (colon <= 0) continue;
    let prop = chunk.slice(0, colon).trim();
    const value = chunk.slice(colon + 1).trim();
    if (!prop || !value || value.length > MAX_VALUE) continue;
    if (!prop.startsWith('--')) prop = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).toLowerCase();
    if (!/^(--[a-zA-Z0-9-]+|-?[a-z][a-z-]*)$/.test(prop) || BLOCKED_PROPERTIES.has(prop)) continue;
    if (/[{}<>\\]/.test(value) || /expression\s*\(|javascript:|vbscript:|@import/i.test(value)) continue;
    const urls = [...value.matchAll(/url\(([^)]*)\)/gi)].map((m) => m[1] ?? '');
    if (urls.some((url) => !safeUrl(url))) continue;
    out.push(`${prop}: ${value}`);
  }
  return out.join('; ');
}

/** True when an href is safe to render on a public page. */
export function safeElementHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined;
  const value = href.trim();
  if (!value) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(value) || value.startsWith('/') || value.startsWith('#')) return value;
  return undefined;
}

/** True when an image source is safe to render. */
export function safeElementSrc(src: unknown): string | undefined {
  if (typeof src !== 'string' || !src.trim()) return undefined;
  return safeUrl(src) ? src.trim() : undefined;
}

/**
 * The stylesheet for one element: base, hover and phone rules scoped to its own class.
 * The id is reduced to [a-z0-9-] so it can never escape the selector.
 */
export function elementStylesheet(
  id: string,
  css: { base?: unknown; hover?: unknown; mobile?: unknown },
): { className: string; rules: string } {
  const className = `tel-${String(id).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'x'}`;
  const base = sanitizeElementCss(css.base);
  const hover = sanitizeElementCss(css.hover);
  const mobile = sanitizeElementCss(css.mobile);
  const rules = [
    base ? `.${className}{${base}}` : '',
    hover ? `.${className}:hover{${hover}}` : '',
    mobile ? `@media (max-width: 767px){.${className}{${mobile}}}` : '',
  ].join('');
  return { className, rules };
}
