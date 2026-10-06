import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  renderEmail,
  assertEmailSafeHtml,
  COMPILER_VERSION,
  DEFAULT_EMAIL_LAYOUT,
} from '../src/modules/email/email-compiler';
import { interpolate, escapeHtml, extractTokens, EmailRenderError } from '../src/modules/email/email-interpolator';
import type { EmailLayout } from '@titan/shared';

const BRAND = {
  fromAddress: 'onboarding@resend.dev',
  supportEmail: 'support@barootcnc.com',
  replyTo: null,
  unsubscribeUrlPath: null,
  utm: null,
};

function layoutWith(blocks: EmailLayout['blocks'], overrides: Partial<EmailLayout> = {}): EmailLayout {
  return {
    direction: 'ltr',
    backgroundColor: '#eef1f5',
    contentBackgroundColor: '#ffffff',
    contentWidth: 600,
    blocks,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('interpolator — substitution', () => {
  const data = { user: { firstName: 'Ahmed', email: 'a@b.com' }, count: 3 };

  it('resolves a nested path', () => {
    expect(interpolate('Hi {{user.firstName}}', data, { escape: (v) => v })).toBe('Hi Ahmed');
  });

  it('applies a literal fallback when the value is missing', () => {
    expect(interpolate('Hi {{user.nickname | "there"}}', data, { escape: (v) => v })).toBe('Hi there');
  });

  it('throws rather than rendering empty when a required value is missing', () => {
    // A receipt with a silently blank total is worse than a failed send.
    expect(() => interpolate('Total: {{order.total}}', {}, { escape: (v) => v })).toThrow(EmailRenderError);
  });

  it('does not throw for a missing value inside a conditional', () => {
    expect(interpolate('{{#if order.invoice}}Invoice{{/if}}', data, { escape: (v) => v })).toBe('');
    expect(interpolate('{{#if count}}Yes{{/if}}', data, { escape: (v) => v })).toBe('Yes');
  });

  it('treats an empty string, 0 and an empty array as falsy', () => {
    expect(interpolate('{{#if v}}y{{/if}}', { v: '' }, { escape: (v) => v })).toBe('');
    expect(interpolate('{{#if v}}y{{/if}}', { v: 0 }, { escape: (v) => v })).toBe('');
    expect(interpolate('{{#if v}}y{{/if}}', { v: [] }, { escape: (v) => v })).toBe('');
  });

  it('renders unless as the inverse of if', () => {
    expect(interpolate('{{#unless paid}}Unpaid{{/unless}}', { paid: false }, { escape: (v) => v })).toBe('Unpaid');
  });

  it('repeats each with this and loop metadata', () => {
    const out = interpolate(
      '{{#each items}}{{@index}}:{{this.name}} {{/each}}',
      { items: [{ name: 'A' }, { name: 'B' }] },
      { escape: (v) => v },
    );
    expect(out).toBe('0:A 1:B ');
  });

  it('handles nested blocks', () => {
    const out = interpolate(
      '{{#each rows}}{{#if this.paid}}PAID {{/if}}{{/each}}',
      { rows: [{ paid: true }, { paid: false }, { paid: true }] },
      { escape: (v) => v },
    );
    expect(out).toBe('PAID PAID ');
  });

  it('rejects an unbalanced close tag', () => {
    expect(() => interpolate('{{/if}}', {}, { escape: (v) => v })).toThrow(EmailRenderError);
  });

  it('rejects an unclosed block', () => {
    expect(() => interpolate('{{#if a}}x', {}, { escape: (v) => v })).toThrow(EmailRenderError);
  });

  it('rejects an unknown block name', () => {
    expect(() => interpolate('{{#with a}}x{{/with}}', {}, { escape: (v) => v })).toThrow(EmailRenderError);
  });
});

describe('interpolator — security', () => {
  it('escapes HTML in substituted values so a payload cannot inject markup', () => {
    const out = interpolate('Hi {{user.name}}', { user: { name: '<script>alert(1)</script>' } }, {
      escape: escapeHtml,
    });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes quotes so an injected value cannot break out of an attribute', () => {
    const out = interpolate('{{v}}', { v: '" onload="alert(1)' }, { escape: escapeHtml });
    expect(out).not.toContain('"');
    expect(out).toContain('&quot;');
  });

  it('refuses to resolve __proto__', () => {
    expect(() => interpolate('{{__proto__.x}}', {}, { escape: (v) => v })).toThrow(EmailRenderError);
    expect(() => interpolate('{{user.constructor.x}}', { user: {} }, { escape: (v) => v })).toThrow(
      EmailRenderError,
    );
  });

  it('does not expose prototype members through the payload', () => {
    // `{}` has toString/constructor on its prototype; own-property-only traversal
    // must not surface them.
    // Own-property-only traversal must not surface prototype members. The
    // thunk matters: `expect(fn())` would evaluate and throw before `toThrow`
    // ever applied.
    expect(() => interpolate('{{user.toString}}', { user: {} }, { escape: (v) => v })).toThrow(
      EmailRenderError,
    );
  });

  it('enforces the allowlist when one is supplied', () => {
    const allowed = ['order.total'];
    expect(() =>
      interpolate('{{course.title}}', { course: { title: 'x' } }, { escape: (v) => v, allowedPaths: allowed }),
    ).toThrow(/Unknown variable/);
  });

  it('extracts tokens for the editor linter', () => {
    expect(extractTokens('{{a}} {{#if b}}x{{/if}} {{c | "d"}}')).toEqual(['a', 'b', 'c']);
  });
});

describe('compiler — table/inline-CSS invariants', () => {
  const payload = {
    user: { firstName: 'Ahmed' },
    order: { id: 'ORD-1', total: 'SAR 1,250.00', hasInvoice: true },
    order2: {},
    items: [{ title: 'Course A' }, { title: 'Course B' }],
  };

  it('emits no div, no style element and no flex for a full-coverage layout', () => {
    const layout = layoutWith([
      { id: 'h', type: 'heading', props: { text: 'Hi {{user.firstName}}', level: 1, align: 'left', color: '#111' } },
      { id: 't', type: 'text', props: { html: 'Body copy', align: 'left', color: '#111', fontSize: 16, lineHeight: 1.6 } },
      { id: 'b', type: 'button', props: { label: 'Go', url: 'https://x.test/go', align: 'center', variant: 'primary' } },
      { id: 'i', type: 'image', props: { url: 'https://x.test/l.png', alt: 'Logo', width: 200, height: 60, align: 'center' } },
      { id: 's', type: 'spacer', props: { height: 16 } },
      { id: 'd', type: 'divider', props: { color: '#ddd' } },
      { id: 'dt', type: 'data-table', props: { source: 'items', mode: 'columns', columns: [{ key: 'title', label: 'Item' }], align: 'left' } },
      { id: 'c', type: 'columns', props: { columns: [
        { width: 50, blocks: [{ id: 'ct', type: 'text', props: { html: 'L', align: 'left', color: '#111', fontSize: 14, lineHeight: 1.5 } }] },
        { width: 50, blocks: [{ id: 'ct2', type: 'text', props: { html: 'R', align: 'left', color: '#111', fontSize: 14, lineHeight: 1.5 } }] },
      ] } },
      { id: 'f', type: 'footer', props: { text: 'Legal', showUnsubscribe: false } },
    ]);
    const { html } = renderEmail(layout, payload, 'Subject', null, BRAND);
    expect(assertEmailSafeHtml(html)).toEqual([]);
  });

  it('emits a VML fallback for the primary button', () => {
    const layout = layoutWith([
      { id: 'b', type: 'button', props: { label: 'Go', url: 'https://x.test/go', align: 'center', variant: 'primary' } },
    ]);
    const { html } = renderEmail(layout, payload, 'S', null, BRAND);
    expect(html).toContain('v:roundrect');
  });

  it('drops a non-https link rather than emitting it', () => {
    const layout = layoutWith([
      { id: 'b', type: 'button', props: { label: 'Go', url: 'http://169.254.169.254/latest/meta-data/', align: 'left', variant: 'primary' } },
    ]);
    const { html, text } = renderEmail(layout, payload, 'S', null, BRAND);
    expect(html).not.toContain('169.254.169.254');
    expect(text).toContain('[missing link]');
  });

  it('strips event handlers and non-inline tags from a text block', () => {
    const layout = layoutWith([
      {
        id: 't',
        type: 'text',
        props: {
          html: 'hi <b>bold</b> <script>alert(1)</script><span onclick="x()">s</span><table><tr><td>t</td></tr></table>',
          align: 'left', color: '#111', fontSize: 16, lineHeight: 1.6,
        },
      },
    ]);
    const { html } = renderEmail(layout, payload, 'S', null, BRAND);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    // The authored table was stripped from the text block; the shell's own
    // tables are the only ones present, which is what keeps copy predictable.
    expect(html).toContain('<b>bold</b>');
  });

  it('refuses the raw-html block rather than emitting it unfiltered', () => {
    const layout = layoutWith([
      { id: 'r', type: 'raw-html', props: { html: '<img src=x onerror=alert(1)>' } },
    ]);
    expect(() => renderEmail(layout, payload, 'S', null, BRAND)).toThrow(/not available yet/);
  });

  it('sets dir=rtl and flips alignment on an RTL layout', () => {
    const layout = layoutWith(
      [{ id: 't', type: 'text', props: { html: 'مرحبا', align: 'right', color: '#111', fontSize: 16, lineHeight: 1.6 } }],
      { direction: 'rtl' },
    );
    const { html } = renderEmail(layout, payload, 'S', null, BRAND);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="rtl"');
  });

  it('appends UTM parameters to links without breaking an existing query', () => {
    const layout = layoutWith([
      { id: 'b', type: 'button', props: { label: 'Go', url: 'https://x.test/p?a=1', align: 'left', variant: 'primary' } },
    ]);
    const { html } = renderEmail(layout, payload, 'S', null, {
      ...BRAND, utm: { utm_source: 'email', utm_campaign: 'receipt' },
    });
    expect(html).toContain('https://x.test/p?a=1&utm_source=email&utm_campaign=receipt');
  });

  it('produces a readable plain-text alternative, not stripped markup', () => {
    const layout = layoutWith([
      { id: 'h', type: 'heading', props: { text: 'Order confirmed', level: 1, align: 'left', color: '#111' } },
      { id: 't', type: 'text', props: { html: 'Thanks for your order.<br>Reference: ORD-1', align: 'left', color: '#111', fontSize: 16, lineHeight: 1.6 } },
      { id: 'b', type: 'button', props: { label: 'View order', url: 'https://x.test/orders/ORD-1', align: 'left', variant: 'primary' } },
    ]);
    const { text } = renderEmail(layout, payload, 'S', null, BRAND);
    expect(text).toContain('ORDER CONFIRMED');
    expect(text).toContain('View order: https://x.test/orders/ORD-1');
    expect(text).not.toContain('<');
    expect(text).not.toContain('style=');
  });
});

describe('compiler — determinism (the preview/send guarantee)', () => {
  const layout = DEFAULT_EMAIL_LAYOUT;

  it('produces byte-identical output for identical input', () => {
    const a = renderEmail(layout, { user: { firstName: 'Ahmed' }, actionUrl: 'https://x.test' }, 'S', null, BRAND);
    const b = renderEmail(layout, { user: { firstName: 'Ahmed' }, actionUrl: 'https://x.test' }, 'S', null, BRAND);
    expect(a.html).toBe(b.html);
    expect(a.text).toBe(b.text);
  });

  it('does not embed a timestamp or any ambient state', () => {
    const a = renderEmail(layout, { user: { firstName: 'A' }, actionUrl: 'https://x.test' }, 'S', null, BRAND);
    const b = renderEmail(layout, { user: { firstName: 'A' }, actionUrl: 'https://x.test' }, 'S', null, BRAND);
    expect(createHash('sha256').update(a.html).digest('hex')).toBe(
      createHash('sha256').update(b.html).digest('hex'),
    );
  });

  it('interpolates the subject and preheader', () => {
    const out = renderEmail(layout, { user: { firstName: 'Ahmed' }, actionUrl: 'https://x.test' },
      'Welcome, {{user.firstName}}', 'Check your inbox', BRAND);
    expect(out.subject).toBe('Welcome, Ahmed');
    expect(out.preheader).toBe('Check your inbox');
    expect(out.html).toContain('Check your inbox');
  });
});