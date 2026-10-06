/**
 * The trigger registry. Code-defined and exhaustive: there is no free-text
 * trigger field anywhere in the product, so an admin can only bind a template to
 * an event we actually emit, and a template's variable allowlist always has a
 * matching payload shape.
 *
 * Adding a trigger means adding an entry here and calling
 * EmailDispatchService.enqueue() from the owning service. `emitSites` records
 * where, which makes "which events exist and who fires them" greppable and lets
 * the registry contract test fail loudly when a cited call site disappears.
 */

import type { EmailCategory, EmailVariableDef } from '@titan/shared';

export interface TriggerDef {
  key: string;
  category: EmailCategory;
  label: string;
  description: string;
  /**
   * Closed contract. The renderer refuses any token outside this list, so a
   * template bound to `commerce.order_paid` cannot read `course.title` — that is
   * not in the payload, and reading it is a bug, not a feature.
   */
  variables: EmailVariableDef[];
  /**
   * True when one occurrence of the event must produce at most one email. These
   * triggers always pass an `idempotencyKey`; the rest omit it deliberately
   * (a re-sent verification is a new event, not a duplicate).
   */
  idempotent: boolean;
  /** Source of truth for who emits this. Checked by the registry contract test. */
  emitSites: string[];
  samplePayload: Record<string, unknown>;
}

const v = (
  path: string,
  type: EmailVariableDef['type'],
  required: boolean,
  label: string,
  example: string,
  extra: Partial<EmailVariableDef> = {},
): EmailVariableDef => ({ path, type, required, label, example, ...extra });

export const TRIGGER_REGISTRY: TriggerDef[] = [
  {
    key: 'auth.email_verification',
    category: 'auth',
    label: 'Email verification',
    description:
      'Sent after signup. Confirmation is NOT a gate — the account is usable immediately; this mail only proves the address.',
    idempotent: false,
    emitSites: ['apps/backend/src/modules/auth/auth.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('user.email', 'string', true, 'Email address', 'ahmed@example.com'),
      v('verifyUrl', 'url', true, 'Verification link', 'https://app.example.com/auth/verify-email?token=…'),
      v('expiresInMinutes', 'number', true, 'Link lifetime (minutes)', '1440'),
      v('supportEmail', 'string', true, 'Support address', 'support@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed', email: 'ahmed@example.com' },
      verifyUrl: 'https://app.example.com/auth/verify-email?token=sample',
      expiresInMinutes: 1440,
      supportEmail: 'support@example.com',
    },
  },
  {
    key: 'auth.welcome',
    category: 'auth',
    label: 'Welcome',
    description: 'First-run orientation after the first verified sign-in.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/auth/auth.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('user.email', 'string', true, 'Email address', 'ahmed@example.com'),
      v('dashboardUrl', 'url', true, 'Dashboard link', 'https://app.example.com/dashboard'),
      v('academyUrl', 'url', true, 'Academy link', 'https://app.example.com/academy'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed', email: 'ahmed@example.com' },
      dashboardUrl: 'https://app.example.com/dashboard',
      academyUrl: 'https://app.example.com/academy',
    },
  },
  {
    key: 'auth.password_reset',
    category: 'auth',
    label: 'Password reset',
    description:
      'The app renders the mail; Supabase verifies the credential. Uses generateLink() with its action link discarded so Supabase does not send a competing email.',
    idempotent: false,
    emitSites: ['apps/backend/src/modules/auth/auth.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('resetUrl', 'url', true, 'Reset link', 'https://app.example.com/reset-password?token_hash=…'),
      v('expiresInMinutes', 'number', true, 'Link lifetime (minutes)', '60'),
      v('supportEmail', 'string', true, 'Support address', 'support@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed', email: 'ahmed@example.com' },
      resetUrl: 'https://app.example.com/reset-password?token_hash=sample',
      expiresInMinutes: 60,
      supportEmail: 'support@example.com',
    },
  },
  {
    key: 'auth.password_changed',
    category: 'auth',
    label: 'Password changed',
    description: 'Security notice after a successful reset.',
    idempotent: false,
    emitSites: ['apps/backend/src/modules/auth/auth.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('changedAt', 'date', true, 'When it changed', '2026-10-06T01:20:00.000Z'),
      v('user.email', 'string', true, 'Email address', 'ahmed@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed', email: 'ahmed@example.com' },
      changedAt: '2026-10-06T01:20:00.000Z',
    },
  },
  {
    key: 'lms.enrollment_confirmed',
    category: 'learning',
    label: 'Enrollment confirmed',
    description: 'Sent when a learner is confirmed onto a course.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/progress/progress.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('course.title', 'string', true, 'Course title', 'CNC Milling Fundamentals'),
      v('course.url', 'url', true, 'Course link', 'https://app.example.com/courses/cnc-milling'),
      v('enrolledAt', 'date', true, 'Enrolment date', '2026-10-06T01:20:00.000Z'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed' },
      course: { title: 'CNC Milling Fundamentals', url: 'https://app.example.com/courses/cnc-milling' },
      enrolledAt: '2026-10-06T01:20:00.000Z',
    },
  },
  {
    key: 'lms.certificate_issued',
    category: 'learning',
    label: 'Certificate issued',
    description: 'Sent when a certificate is issued, with its signed single-use link.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/certification/certification.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('course.title', 'string', true, 'Course title', 'CNC Milling Fundamentals'),
      v('certificateUrl', 'url', true, 'Certificate link', 'https://app.example.com/certificates/abc'),
      v('certificateId', 'string', true, 'Certificate reference', 'cert_01H…'),
      v('issuedAt', 'date', true, 'Issue date', '2026-10-06T01:20:00.000Z'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed' },
      course: { title: 'CNC Milling Fundamentals' },
      certificateUrl: 'https://app.example.com/certificates/00000000-0000-0000-0000-000000000000',
      certificateId: 'cert_01HZZZ',
      issuedAt: '2026-10-06T01:20:00.000Z',
    },
  },
  {
    key: 'commerce.order_paid',
    category: 'commerce',
    label: 'Order paid',
    description:
      'Receipt. Emitted from the single-writer payment claim, so the first writer to mark an order paid is the only one that can enqueue it.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/payments/moyasar.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('order.id', 'string', true, 'Order reference', 'ORD-10021'),
      v('order.total', 'money', true, 'Total charged', 'SAR 1,250.00'),
      v('order.currency', 'string', true, 'Currency', 'SAR'),
      v('order.paidAt', 'date', true, 'Payment time', '2026-10-06T01:20:00.000Z'),
      v('order.items', 'string', true, 'Line items', 'CNC Milling Course x1'),
      v('order.hasInvoice', 'boolean', false, 'Show invoice section', 'true'),
      v('invoiceUrl', 'url', false, 'Invoice link (when hasInvoice)', 'https://app.example.com/orders/ORD-10021/invoice'),
      v('supportEmail', 'string', true, 'Support address', 'support@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed' },
      order: {
        id: 'ORD-10021',
        total: 'SAR 1,250.00',
        currency: 'SAR',
        paidAt: '2026-10-06T01:20:00.000Z',
        items: 'CNC Milling Fundamentals x1\nWorkholding Essentials x1',
        hasInvoice: true,
      },
      invoiceUrl: 'https://app.example.com/orders/ORD-10021/invoice',
      supportEmail: 'support@example.com',
    },
  },
  {
    key: 'commerce.order_failed',
    category: 'commerce',
    label: 'Payment failed',
    description: 'Sent when a gateway declines or the order fails fulfilment checks.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/payments/moyasar.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('order.id', 'string', true, 'Order reference', 'ORD-10021'),
      v('order.total', 'money', true, 'Total attempted', 'SAR 1,250.00'),
      v('order.reason', 'string', true, 'Why it failed', 'Card declined'),
      v('retryUrl', 'url', true, 'Retry link', 'https://app.example.com/orders/ORD-10021/retry'),
      v('supportEmail', 'string', true, 'Support address', 'support@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed' },
      order: { id: 'ORD-10021', total: 'SAR 1,250.00', reason: 'Card declined' },
      retryUrl: 'https://app.example.com/orders/ORD-10021/retry',
      supportEmail: 'support@example.com',
    },
  },
  {
    key: 'commerce.refund_issued',
    category: 'commerce',
    label: 'Refund issued',
    description: 'Sent when a refund is processed, full or partial.',
    idempotent: true,
    emitSites: ['apps/backend/src/modules/payments/moyasar.service.ts'],
    variables: [
      v('user.firstName', 'string', true, 'First name', 'Ahmed'),
      v('order.id', 'string', true, 'Order reference', 'ORD-10021'),
      v('order.refundAmount', 'money', true, 'Amount refunded', 'SAR 500.00'),
      v('order.refundedAt', 'date', true, 'Refund time', '2026-10-06T01:20:00.000Z'),
      v('supportEmail', 'string', true, 'Support address', 'support@example.com'),
    ],
    samplePayload: {
      user: { firstName: 'Ahmed' },
      order: { id: 'ORD-10021', refundAmount: 'SAR 500.00', refundedAt: '2026-10-06T01:20:00.000Z' },
      supportEmail: 'support@example.com',
    },
  },
  {
    key: 'admin.custom',
    category: 'custom',
    label: 'Custom (manual)',
    description: 'Composed and sent by an admin. The only trigger whose recipient is operator-supplied.',
    idempotent: false,
    emitSites: ['apps/backend/src/modules/email/admin-email.controller.ts'],
    variables: [
      v('admin.message', 'string', true, 'Message body', 'Thanks for your purchase.'),
      v('admin.actionLabel', 'string', false, 'CTA label', 'View order'),
      v('admin.actionUrl', 'url', false, 'CTA link', 'https://app.example.com/orders/ORD-10021'),
    ],
    samplePayload: {
      admin: { message: 'Thanks for your purchase.', actionLabel: 'View order', actionUrl: 'https://app.example.com/orders/ORD-10021' },
    },
  },
];

export const TRIGGERS_BY_KEY: ReadonlyMap<string, TriggerDef> = new Map(
  TRIGGER_REGISTRY.map((t) => [t.key, t]),
);

export function getTrigger(key: string): TriggerDef | undefined {
  return TRIGGERS_BY_KEY.get(key);
}

/** Paths the renderer will accept for a trigger. Drives both preview and send. */
export function allowedPathsFor(trigger: TriggerDef): string[] {
  return trigger.variables.map((variable) => variable.path);
}

export function isKnownTrigger(key: string): boolean {
  return TRIGGERS_BY_KEY.has(key);
}