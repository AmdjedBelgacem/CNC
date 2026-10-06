/**
 * Email compiler: EmailLayout (JSON blocks) -> table-based, inline-CSS HTML +
 * a readable plain-text alternative.
 *
 * Rules that are contractual, not stylistic:
 *  * No `<div>`, no `<style>`, no classes, no `display:flex`, no relative
 *    URLs. Gmail strips `<style>`; Outlook's Word engine ignores flex. Table
 *    layout with `role="presentation"` is the only near-universal denominator,
 *    and a build-time assertion (see assertEmailSafeHtml) enforces the ban.
 *  * Every visual property is an inline `style` attribute on a `<td>` that also
 *    carries a `bgcolor`, because Outlook ignores `background-color`.
 *  * Nothing here reads the clock, randomness, or the environment. Same layout
 *    + same payload => byte-identical output, which is what makes preview and
 *    send provably the same artifact.
 *
 * Dark mode is NOT controllable: Gmail app and Outlook.com may invert colours
 * regardless of what we emit. We mitigate on the design side (see palette
 * below) and never claim to defeat client dark mode.
 */

import {
  EmailBlock,
  EmailLayout,
  EmailRenderResult,
  EmailTextAlign,
} from '@titan/shared';
import { interpolate, escapeHtml, EmailRenderError } from './email-interpolator';

/**
 * Bumping this invalidates every stored `compile_hash`. It is hashed alongside
 * the output so a compiler change is detectable: re-rendering a published
 * version's sample payload and getting a different hash means the artifact an
 * admin reviewed no longer matches what the compiler produces.
 */
export const COMPILER_VERSION = 1;

/**
 * Variables the ENGINE provides rather than the event emitter.
 *
 * `subject` is resolved by renderEmail and injected into the body payload, so it
 * is available to every template. It has to be allowlisted separately: a bound
 * template restricts tokens to the trigger's event contract, which does not and
 * should not describe engine-provided values. Keeping this list explicit (rather
 * than widening the allowlist) means the boundary between "engine surface" and
 * "event payload" stays visible.
 */
const IMPLICIT_BODY_PATHS = ['subject'];

const BRAND_NAME = 'Baroot CNC Solutions';

/**
 * Slightly-off-white/black rather than pure values. Pure #ffffff / #000000 are
 * the two colours clients invert most aggressively in forced-dark modes, so
 * avoiding them is the only lever that survives Gmail's inversion.
 */
const PALETTE = {
  ink: '#1a1a1a',
  muted: '#5f6b7a',
  pageBg: '#eef1f5',
  cardBg: '#ffffff',
  accent: '#0b6b5f',
  accentText: '#ffffff',
  border: '#dfe4ea',
  footerBg: '#f6f8fa',
};

export interface CompileOptions {
  /** Closed allowlist of variable paths; see interpolator. */
  allowedPaths?: readonly string[];
  fromAddress: string;
  replyTo?: string | null;
  supportEmail?: string | null;
  /** Rendered in the footer for unsubscribe. Variable path, never a literal URL. */
  unsubscribeUrlPath?: string | null;
  /** Appended to every link for analytics. Appended verbatim, so no leading '?'. */
  utm?: Record<string, string> | null;
}

function attrs(pairs: Array<[string, string | number | boolean | null | undefined]>): string {
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '')
    .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join('');
}

function align(style: string, a: EmailTextAlign): string {
  const v = a === 'center' ? 'center' : a === 'right' ? 'right' : 'left';
  return `${style};text-align:${v}`;
}

/** Pad short URLs so Outlook/Apple Mail do not truncate a trailing `#`. */
function appendUtm(url: string, utm?: Record<string, string> | null): string {
  if (!utm || Object.keys(utm).length === 0) return url;
  const parts = url.split('#');
  const clean = parts[0] ?? url;
  const hash = parts.length > 1 ? `#${parts.slice(1).join('#')}` : '';
  const params = Object.entries(utm)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (!params) return url;
  return `${clean}${clean.includes('?') ? '&' : '?'}${params}${hash}`;
}

/**
 * Only absolute https URLs survive. This is what stops a template author
 * pointing a CTA at `http://169.254.169.254/latest/meta-data/` — the renderer
 * refuses to emit a non-https href rather than trusting the author.
 */
function safeUrl(raw: string, utm?: Record<string, string> | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (!/^https:\/\//i.test(trimmed)) return '';
  return appendUtm(trimmed, utm);
}

function textToken(
  src: string,
  payload: Record<string, unknown>,
  allowedPaths?: readonly string[],
  escape = escapeHtml,
): string {
  return interpolate(src, payload, { escape, allowedPaths });
}

/** Strip any tag the compiler does not explicitly emit from a text block. */
function sanitizeInlineHtml(html: string): string {
  return html
    .replace(/<(?!\/?(b|i|u|a|span|br)(\s|>|\/))[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function renderBlocks(
  blocks: EmailBlock[],
  o: CompileOptions,
  payload: Record<string, unknown>,
): { html: string; text: string } {
  let html = '';
  const textParts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const { text, level, align: a, color } = block.props;
        const rendered = textToken(text, payload, o.allowedPaths);
        const tag = `h${level}`;
        html += `<tr><td${attrs([
          ['align', a],
          ['style', align('margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700', a)],
        ])}><${tag} style="margin:0 0 12px;font-size:${level === 1 ? 22 : level === 2 ? 19 : 16}px;line-height:1.3;font-weight:700;color:${color || PALETTE.ink}">${rendered}</${tag}></td></tr>`;
        textParts.push(rendered.toUpperCase());
        textParts.push('='.repeat(Math.min(rendered.length, 60)));
        break;
      }

      case 'text': {
        const { html: body, align: a, color, fontSize, lineHeight, label } = block.props;
        const rendered = textToken(sanitizeInlineHtml(body), payload, o.allowedPaths);
        let cell = '';
        if (label) {
          const l = textToken(label, payload, o.allowedPaths);
          cell += `<p style="margin:0 0 6px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${PALETTE.muted}">${l}</p>`;
          textParts.push(l.toUpperCase());
        }
        cell += `<p style="margin:0;font-size:${fontSize || 16}px;line-height:${lineHeight || 1.6};color:${color || PALETTE.ink}">${rendered}</p>`;
        html += `<tr><td${attrs([
          ['align', a],
          ['style', align('padding:0 0 16px', a)],
        ])}>${cell}</td></tr>`;
        textParts.push(
          interpolate(body, payload, { escape: (v) => v, allowedPaths: o.allowedPaths })
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?(b|i|u|span)[^>]*>/gi, '')
            .trim(),
        );
        break;
      }

      case 'button': {
        const { label, url, align: a, variant } = block.props;
        const href = safeUrl(textToken(url, payload, o.allowedPaths), o.utm);
        const labelHtml = textToken(label, payload, o.allowedPaths);
        if (!href) {
          html += `<tr><td${attrs([
            ['align', a],
            ['style', 'padding:0 0 16px'],
          ])}><span style="color:${PALETTE.muted};font-size:14px">[missing link]</span></td></tr>`;
          textParts.push('[missing link]');
          break;
        }
        if (variant === 'link') {
          html += `<tr><td${attrs([
            ['align', a],
            ['style', align('padding:0 0 16px', a)],
          ])}><a href="${href}" target="_blank" style="color:${PALETTE.accent};font-size:15px;text-decoration:underline">${labelHtml}</a></td></tr>`;
          textParts.push(`${labelHtml}: ${href}`);
          break;
        }
        const primary = variant === 'primary';
        const bg = primary ? PALETTE.accent : 'transparent';
        const fg = primary ? PALETTE.accentText : PALETTE.accent;
        // VML roundrect is still the only CTA Outlook renders reliably.
        html +=
          `<tr><td${attrs([['align', a], ['style', align('padding:4px 0 20px', a)]])}>` +
          `<table${attrs([['role', 'presentation'], ['border', '0'], ['cellpadding', '0'], ['cellspacing', '0'], ['align', a]])}><tr>` +
          `<td${attrs([['align', 'center'], ['bgcolor', bg], ['style', `background-color:${bg};border-radius:6px;mso-padding-alt:14px 26px`]])}>` +
          `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" arcsize="14%" style="height:46px;v-text-anchor:middle;width:220px;" strokecolor="${PALETTE.accent}" fillcolor="${PALETTE.accent}"><w:anchorlock/></v:roundrect><![endif]-->` +
          `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;line-height:1;color:${fg};text-decoration:none;min-width:44px">${labelHtml}</a>` +
          `</td></tr></table></td></tr>`;
        textParts.push(`${labelHtml}: ${href}`);
        break;
      }

      case 'image': {
        const { url, alt, width, height, align: a } = block.props;
        const src = safeUrl(textToken(url, payload, o.allowedPaths), o.utm);
        // alt is mandatory in the type: clients that block images fall back to it.
        const altText = textToken(alt, payload, o.allowedPaths) || BRAND_NAME;
        html += `<tr><td${attrs([['align', a], ['style', align('padding:0 0 16px', a)]])}>` +
          `<img src="${src}" alt="${altText}" width="${width || 600}" height="${height || 150}"${attrs([['style', 'display:block;border:0;max-width:100%;height:auto']])} /></td></tr>`;
        textParts.push(altText);
        break;
      }

      case 'spacer': {
        const h = Math.max(0, Math.min(block.props.height || 16, 200));
        html += `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:${h}px">&nbsp;</td></tr>`;
        break;
      }

      case 'divider': {
        html += `<tr><td style="padding:0 0 16px"><table${attrs([['role', 'presentation'], ['border', '0'], ['cellpadding', '0'], ['cellspacing', '0'], ['width', '100%']])}><tr><td height="1" bgcolor="${block.props.color || PALETTE.border}" style="height:1px;line-height:1px;font-size:0">&nbsp;</td></tr></table></td></tr>`;
        textParts.push('---');
        break;
      }

      case 'data-table': {
        const { source, mode, columns, align: a, labelKey, valueKey } = block.props;
        // Resolved unescaped: this is a payload lookup for a row array, not
        // display text. Cell values are escaped individually below.
        const rows = interpolate(source, payload, { escape: (v) => v, allowedPaths: o.allowedPaths });
        let table = `<table${attrs([['role', 'presentation'], ['border', '0'], ['cellpadding', '0'], ['cellspacing', '0'], ['width', '100%'], ['style', 'width:100%;border-collapse:collapse']])}>`;
        if (mode === 'columns' && columns.length) {
          table += `<tr>${columns
            .map(
              (c) =>
                `<th${attrs([['align', c.align ?? a], ['style', `padding:8px 10px;border-bottom:2px solid ${PALETTE.border};font-size:13px;font-weight:700;color:${PALETTE.ink};text-align:${c.align ?? a}`]])}>${escapeHtml(c.label)}</th>`,
            )
            .join('')}</tr>`;
        }
        const items = Array.isArray(rows) ? rows : rows ? [rows] : [];
        if (items.length === 0) {
          table += `<tr><td style="padding:8px 0;font-size:14px;color:${PALETTE.muted}">${escapeHtml('—')}</td></tr>`;
          textParts.push('—');
        }
        for (const item of items) {
          if (mode === 'columns') {
            table += `<tr>${columns
              .map(
                (c) =>
                  `<td${attrs([['align', c.align ?? a], ['style', `padding:8px 10px;border-bottom:1px solid ${PALETTE.border};font-size:14px;color:${PALETTE.ink};text-align:${c.align ?? a}`]])}>${escapeHtml(stringifyCell(item, c.key))}</td>`,
              )
              .join('')}</tr>`;
          } else {
            const label = labelKey ? stringifyCell(item, labelKey) : '';
            const value = valueKey ? stringifyCell(item, valueKey) : stringifyCell(item, 'value');
            table += `<tr><td${attrs([['width', '45%'], ['style', `padding:8px 10px;border-bottom:1px solid ${PALETTE.border};font-size:14px;color:${PALETTE.muted}`]])}>${escapeHtml(label)}</td><td${attrs([['align', 'right'], ['style', `padding:8px 10px;border-bottom:1px solid ${PALETTE.border};font-size:14px;font-weight:700;color:${PALETTE.ink};text-align:right`]])}>${escapeHtml(value)}</td></tr>`;
          }
          textParts.push(
            mode === 'columns'
              ? columns.map((c) => `${c.label}: ${stringifyCell(item, c.key)}`).join('  ')
              : `${labelKey ? stringifyCell(item, labelKey) : ''}: ${valueKey ? stringifyCell(item, valueKey) : stringifyCell(item, 'value')}`,
          );
        }
        table += `</table>`;
        html += `<tr><td${attrs([['align', a], ['style', align('padding:0 0 16px', a)]])}>${table}</td></tr>`;
        break;
      }

      case 'columns': {
        // Inline-block with an inline spacer, not flex: the only two-up that both
        // Outlook and Gmail render side by side.
        const cells = block.props.columns
          .map((col) => {
            const inner = renderBlocks(col.blocks, o, payload);
            return `<td${attrs([['width', `${col.width}%`], ['valign', 'top'], ['style', `width:${col.width}%;padding:0 6px;vertical-align:top`]])}>${inner.html}</td>`;
          })
          .join(`<td style="width:2px;font-size:0;line-height:0">&nbsp;</td>`);
        html += `<tr><td style="padding:0 0 16px"><table${attrs([['role', 'presentation'], ['border', '0'], ['cellpadding', '0'], ['cellspacing', '0'], ['width', '100%']])}><tr>${cells}</tr></table></td></tr>`;
        for (const col of block.props.columns) textParts.push(renderBlocks(col.blocks, o, payload).text);
        break;
      }

      case 'footer': {
        const { text, showUnsubscribe } = block.props;
        let inner = '';
        if (text) {
          const t = textToken(text, payload, o.allowedPaths);
          inner += `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${PALETTE.muted}">${t}</p>`;
          textParts.push(t);
        }
        let unsubUrl = '';
        if (showUnsubscribe && o.unsubscribeUrlPath) {
          unsubUrl = safeUrl(textToken(o.unsubscribeUrlPath, payload, o.allowedPaths), o.utm);
        }
        if (unsubUrl) {
          inner += `<p style="margin:0 0 10px;font-size:13px"><a href="${unsubUrl}" target="_blank" style="color:${PALETTE.muted};text-decoration:underline">Unsubscribe</a></p>`;
          textParts.push(`Unsubscribe: ${unsubUrl}`);
        }
        const support = o.supportEmail
          ? `<p style="margin:0;font-size:13px;line-height:1.6;color:${PALETTE.muted}">Questions? <a href="mailto:${o.supportEmail}" style="color:${PALETTE.accent}">${o.supportEmail}</a></p>`
          : '';
        if (o.supportEmail) textParts.push(`Questions? ${o.supportEmail}`);
        html += `<tr><td bgcolor="${PALETTE.footerBg}" style="background-color:${PALETTE.footerBg};padding:20px 24px;border-radius:6px">${inner}${support}</td></tr>`;
        break;
      }

      case 'raw-html': {
        // P1 sanitized passthrough. P0 has no sanitizer wired, so this block is
        // refused rather than emitted unfiltered — the alternative is an XSS hole
        // reachable from the admin editor.
        throw new EmailRenderError(
          'The raw-html block is not available yet (P1). Use text/button/image blocks.',
        );
      }
    }
  }

  return { html, text: textParts.filter((t) => t.trim().length).join('\n\n') };
}

function stringifyCell(item: unknown, key: string): string {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return String(item);
  const v = (item as Record<string, unknown>)[key];
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/**
 * The starter layout.
 *
 * It references NO trigger variable at all — only the engine-provided
 * `{{subject}}`. That is a hard constraint, not laziness: no single variable is
 * universal across the registry (`admin.custom` addresses a raw recipient and has
 * no `user.firstName`; nothing outside commerce has an `order.total`), so any
 * starter that greeted someone or carried a CTA would fail to render against
 * most triggers the instant an admin bound it.
 *
 * Greetings and CTAs are therefore inserted from the editor's variables panel,
 * which only offers paths the bound trigger actually declares. Seeded
 * per-trigger starters land with the P1 template migration. A registry test
 * asserts this layout renders against every registered trigger.
 */
export const DEFAULT_EMAIL_LAYOUT: EmailLayout = {
  direction: 'ltr',
  backgroundColor: PALETTE.pageBg,
  contentBackgroundColor: PALETTE.cardBg,
  contentWidth: 600,
  blocks: [
    { id: 'h1', type: 'heading', props: { text: '{{subject}}', level: 1, align: 'left', color: PALETTE.ink } },
    {
      id: 't1',
      type: 'text',
      props: {
        html: 'Write your message here. Use the variables panel to insert values this trigger provides.',
        align: 'left',
        color: PALETTE.ink,
        fontSize: 16,
        lineHeight: 1.6,
      },
    },
    { id: 's1', type: 'spacer', props: { height: 8 } },
    { id: 'f1', type: 'footer', props: { text: 'You are receiving this because you have an account.', showUnsubscribe: false } },
  ],
  schemaVersion: 1,
};

/**
 * The single render path. Admin preview and the send pipeline both call this
 * with the same layout and payload, which is what makes "what you build is what
 * you send" a property of the code rather than a convention.
 */
export function renderEmail(
  layout: EmailLayout,
  payload: Record<string, unknown>,
  subjectTemplate: string,
  preheaderTemplate: string | null | undefined,
  options: CompileOptions,
): EmailRenderResult {
  const subject = interpolate(subjectTemplate, payload, {
    escape: (v) => v,
    allowedPaths: options.allowedPaths,
  });
  const preheader = preheaderTemplate
    ? interpolate(preheaderTemplate, payload, { escape: (v) => v, allowedPaths: options.allowedPaths })
    : null;

  // `subject` is exposed to the body so a template can reference it (a heading
  // that repeats the subject line is common), without every caller having to
  // thread it through their payload by hand.
  const body = 'subject' in payload ? payload : { ...payload, subject };
  const bodyOptions: CompileOptions = options.allowedPaths
    ? { ...options, allowedPaths: [...options.allowedPaths, ...IMPLICIT_BODY_PATHS] }
    : options;

  const { html, text } = renderBlocks(layout.blocks, bodyOptions, body);

  const dir = layout.direction === 'rtl' ? 'rtl' : 'ltr';
  const width = Math.max(320, Math.min(layout.contentWidth || 600, 700));
  const pageBg = layout.backgroundColor || PALETTE.pageBg;
  const cardBg = layout.contentBackgroundColor || PALETTE.cardBg;

  const preheaderCell = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(
        preheader,
      )}</div>`
    : '';

  const doc =
    `<!DOCTYPE html>` +
    `<html lang="${dir}" dir="${dir}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light">` +
    `<meta name="supported-color-schemes" content="light">` +
    `<title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background-color:${pageBg};-webkit-text-size-adjust:100%">` +
    preheaderCell +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${pageBg}" style="width:100%;background-color:${pageBg}">` +
    `<tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${width}" bgcolor="${cardBg}" style="width:100%;max-width:${width}px;background-color:${cardBg};border-radius:10px">` +
    `<tr><td style="padding:28px 26px">` +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse">` +
    html +
    `</table></td></tr>` +
    `<tr><td style="padding:0 26px 22px;font-size:11px;line-height:1.5;color:${PALETTE.muted}">` +
    `&copy; ${BRAND_NAME}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { html: doc, text: text.trim() || subject, subject, preheader };
}

/**
 * Build-time guard against the failure modes email clients actually punish.
 * Wired into the compiler test suite; a violation here is a compiler bug.
 */
export function assertEmailSafeHtml(html: string): string[] {
  const violations: string[] = [];
  if (/<style[\s>]/i.test(html)) violations.push('inline-CSS rule violated: <style> element');
  if (/<div[\s>]/i.test(html)) violations.push('table-layout rule violated: <div> element');
  if (/display\s*:\s*flex/i.test(html)) violations.push('Outlook rule violated: display:flex');
  if (/display\s*:\s*grid/i.test(html)) violations.push('unsupported: display:grid');
  if (/<link[^>]+stylesheet/i.test(html)) violations.push('inline-CSS rule violated: external stylesheet');
  const relative = html.match(/href="(?!https:\/\/|mailto:|#)([^"]*)"/gi);
  if (relative) violations.push(`non-absolute link: ${relative[0]}`);
  if (/src="(?!https:\/\/)([^"]*)"/gi.test(html)) violations.push('non-absolute image source');
  if (/<script/i.test(html)) violations.push('script element present');
  return violations;
}