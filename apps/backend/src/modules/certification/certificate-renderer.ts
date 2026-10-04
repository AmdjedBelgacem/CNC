import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/**
 * Certificate variable resolver.
 *
 * The Studio's field designer stores `{ key, label, x, y, fontSize, fontWeight,
 * color }` per field, where `key` names a variable. Before this module existed
 * those keys were written to the database and never read, so the designer was
 * decorative. This turns a template plus a learner/course/academy context into
 * the exact set of strings that get drawn onto the PDF, and — importantly —
 * returns the same resolved values for the audit snapshot.
 *
 * Kept free of Nest/Drizzle so it can be unit tested directly and reused by the
 * admin preview without touching the database.
 */

export interface TemplateFieldDef {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
}

export interface CertificateStyle {
  id: string | null;
  name: string;
  layout: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  fontFamily: string;
  fields: TemplateFieldDef[];
  scopeType: string;
}

export interface CertificateVariables {
  learnerName: string;
  learnerEmail?: string;
  courseTitle: string;
  courseSlug?: string;
  academyName: string;
  issueDate: string;
  certificateNumber: string;
  tenantName: string;
  score?: string;
  hours?: string;
  [extra: string]: string | undefined;
}

/** Keys the designer offers, in the order they appear in the cheatsheet. */
export const CERTIFICATE_VARIABLES = [
  { key: 'learnerName', label: 'Learner name', hint: 'Recipient full name' },
  { key: 'courseTitle', label: 'Course title', hint: 'Course that was completed' },
  { key: 'academyName', label: 'Academy name', hint: 'Awarding academy' },
  { key: 'issueDate', label: 'Issue date', hint: 'Date the certificate was issued' },
  { key: 'certificateNumber', label: 'Certificate no.', hint: 'Unique certificate number' },
  { key: 'tenantName', label: 'Organisation', hint: 'Tenant / brand name' },
  { key: 'score', label: 'Score', hint: 'Final score, when recorded' },
  { key: 'hours', label: 'Course hours', hint: 'Estimated hours, when set' },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value) ? value : fallback;
}

/**
 * Layout used when a template has no fields placed.
 *
 * An active but empty template must not produce a nameless certificate, and it
 * must not silently skip the award either. Rendering this default means a
 * learner still receives a valid, verifiable certificate while the admin sees a
 * clear warning in the Studio.
 */
export function defaultTemplateFields(): TemplateFieldDef[] {
  return [
    { key: 'learnerName', label: 'Learner', x: 50, y: 42, fontSize: 30, fontWeight: '700', color: '#191B1F' },
    { key: 'courseTitle', label: 'Course', x: 50, y: 56, fontSize: 14, fontWeight: 'normal', color: '#475569' },
    { key: 'academyName', label: 'Academy', x: 50, y: 65, fontSize: 11, fontWeight: '600', color: '#64748b' },
    { key: 'certificateNumber', label: 'Certificate no.', x: 50, y: 78, fontSize: 9, fontWeight: 'normal', color: '#94A3B8' },
  ];
}

/** Resolve the fields to draw, falling back to the default layout when empty. */
export function resolveFields(template: CertificateStyle): {
  fields: TemplateFieldDef[];
  usedDefaultLayout: boolean;
} {
  const declared = (template.fields ?? []).filter((f) => f && typeof f.key === 'string');
  if (declared.length === 0) {
    return { fields: defaultTemplateFields(), usedDefaultLayout: true };
  }
  return { fields: declared, usedDefaultLayout: false };
}

/**
 * Map each field to its concrete string. Unknown keys render as a visible
 * placeholder rather than blank space, so a typo in the designer is obvious on
 * the certificate instead of leaving a hole.
 */
export function resolveVariables(
  fields: TemplateFieldDef[],
  variables: CertificateVariables,
): { fields: (TemplateFieldDef & { value: string })[]; unresolved: string[] } {
  const unresolved: string[] = [];
  const resolved = fields.map((field) => {
    const raw = variables[field.key];
    const value =
      typeof raw === 'string' && raw.trim().length > 0
        ? raw
        : `{{${field.key}}}`;
    if (value.startsWith('{{')) unresolved.push(field.key);
    return { ...field, value };
  });
  return { fields: resolved, unresolved };
}

/** A4 landscape, the same aspect the Studio previews at (1.414). */
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

function fontFamilyToStd(name: string): 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' {
  const lower = (name || '').toLowerCase();
  if (lower.includes('playfair') || lower.includes('georgia') || lower.includes('serif')) {
    return 'Times-Roman';
  }
  return 'Helvetica';
}

/**
 * Render a certificate to a PDF buffer.
 *
 * Uses PDFKit's built-in standard fonts so no font files have to be shipped or
 * licensed; `fontFamily` only selects between the serif and sans standard
 * faces. Coordinates come straight from the designer: `x`/`y` are percentages
 * of the page, matching how the Studio positions fields on its canvas.
 */
export function renderCertificatePdf(
  template: CertificateStyle,
  variables: CertificateVariables,
  preResolved?: (TemplateFieldDef & { value: string })[],
): Promise<Buffer> {
  const fields = preResolved ?? resolveVariables(resolveFields(template).fields, variables).fields;
  const primary = safeColor(template.primaryColor, '#0E7490');
  const secondary = safeColor(template.secondaryColor, '#0a1628');
  const baseFont = fontFamilyToStd(template.fontFamily);
  const layout = template.layout || 'modern';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margin: 0,
      info: {
        Title: `Certificate ${variables.certificateNumber}`,
        Author: variables.tenantName,
        Subject: `Certificate of completion — ${variables.courseTitle}`,
        Keywords: 'certificate, completion',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Paper
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#FFFFFF');

    // Layout-specific ornament
    if (layout === 'modern') {
      doc.rect(0, 0, PAGE_WIDTH, 10).fill(primary);
      doc.rect(0, 0, PAGE_WIDTH / 3, 6).fill(secondary);
      doc.circle(40, 40, 70).fillOpacity(0.06).fill(primary);
      doc.circle(PAGE_WIDTH - 30, PAGE_HEIGHT - 30, 90).fillOpacity(0.05).fill(secondary);
      doc.fillOpacity(1);
    } else if (layout === 'classic') {
      doc.lineWidth(3).strokeColor(primary).rect(18, 18, PAGE_WIDTH - 36, PAGE_HEIGHT - 36).stroke();
      doc.lineWidth(1).strokeOpacity(0.6).rect(26, 26, PAGE_WIDTH - 52, PAGE_HEIGHT - 52).stroke();
      doc.strokeOpacity(1);
      // Centred seal
      doc.circle(PAGE_WIDTH / 2, 96, 26).fill(primary);
      doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
        .text('✓', 0, 88, { width: PAGE_WIDTH, align: 'center' });
    } else {
      // minimal: hairline frame only
      doc.lineWidth(0.75).strokeColor(secondary).rect(24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48).stroke();
    }

    // Heading
    const headingFont = layout === 'classic' ? 'Times-Bold' : 'Helvetica-Bold';
    doc
      .fillColor(secondary)
      .font(headingFont)
      .fontSize(13)
      .text((template.name || 'Certificate of Completion').toUpperCase(), 0, 74, {
        width: PAGE_WIDTH,
        align: 'center',
        characterSpacing: 2.2,
      });

    // Designer fields, positioned by percentage
    for (const field of fields) {
      const x = (Math.min(Math.max(field.x, 0), 100) / 100) * PAGE_WIDTH;
      const y = (Math.min(Math.max(field.y, 0), 100) / 100) * PAGE_HEIGHT;
      const size = Math.min(Math.max(field.fontSize, 6), 96);
      const font =
        String(field.fontWeight) === '700' || String(field.fontWeight) === 'bold'
          ? 'Helvetica-Bold'
          : baseFont;
      doc
        .fillColor(safeColor(field.color, '#191B1F'))
        .font(font)
        .fontSize(size)
        .text(field.value, x, y - size / 2, {
          width: PAGE_WIDTH * 0.9,
          align: field.key === 'learnerName' ? 'center' : 'center',
          lineBreak: false,
        });
    }

    // Footer: signature line, seal, date
    const footerY = PAGE_HEIGHT - 62;
    doc.lineWidth(0.75).strokeColor(secondary).strokeOpacity(0.35);
    doc.moveTo(90, footerY).lineTo(210, footerY).stroke();
    doc.moveTo(PAGE_WIDTH - 210, footerY).lineTo(PAGE_WIDTH - 90, footerY).stroke();
    doc.strokeOpacity(1);

    doc
      .fillColor(secondary)
      .font('Helvetica')
      .fontSize(7)
      .text('PROGRAM DIRECTOR', 90, footerY + 6, { width: 120, align: 'center', characterSpacing: 1.2 });
    doc.text(
      variables.issueDate,
      PAGE_WIDTH - 210,
      footerY + 6,
      { width: 120, align: 'center', characterSpacing: 0.6 },
    );

    // Seal with the certificate number
    doc.circle(PAGE_WIDTH / 2, footerY + 8, 15).fill(primary);
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('✓', 0, footerY + 2, { width: PAGE_WIDTH, align: 'center' });
    doc
      .fillColor('#94A3B8')
      .font('Helvetica')
      .fontSize(6)
      .text(`#${variables.certificateNumber}`, 0, footerY + 28, {
        width: PAGE_WIDTH,
        align: 'center',
      });

    // Verification line: the number is the public verification handle, so print it.
    doc
      .fillColor('#94A3B8')
      .font('Helvetica')
      .fontSize(6.5)
      .text(
        `Verify at ${variables.tenantName} · ${variables.certificateNumber}`,
        0,
        PAGE_HEIGHT - 24,
        { width: PAGE_WIDTH, align: 'center' },
      );

    doc.end();
  });
}

@Injectable()
export class CertificateRendererService {
  private readonly logger = new Logger(CertificateRendererService.name);

  async render(
    template: CertificateStyle,
    variables: CertificateVariables,
  ): Promise<{ buffer: Buffer; usedDefaultLayout: boolean; unresolved: string[] }> {
    const { fields, usedDefaultLayout } = resolveFields(template);
    const { fields: resolved, unresolved } = resolveVariables(fields, variables);
    if (usedDefaultLayout) {
      this.logger.warn(
        `Template ${template.id ?? '(unsaved)'} "${template.name}" has no fields; ` +
          `rendering the built-in default layout instead of a blank certificate`,
      );
    }
    if (unresolved.length) {
      this.logger.warn(
        `Template ${template.id ?? '(unsaved)'} referenced unknown variables: ${unresolved.join(', ')}`,
      );
    }
    const buffer = await renderCertificatePdf(template, variables, resolved);
    return { buffer, usedDefaultLayout, unresolved };
  }
}
