import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
/** Designer font size → points: the canvas renders `fontSize / 640` of its width. */
const DESIGNER_SCALE = PAGE_WIDTH / 640;
/** Keep centred text this far from the page edge. */
const FIELD_MARGIN = 36;

/**
 * Draw a check mark as a path.
 *
 * The built-in PDF fonts are WinAnsi-encoded and have no ✓ glyph, so `text('✓')`
 * printed a stray quote mark inside the seal.
 */
function drawCheck(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, color: string) {
  doc
    .save()
    .lineWidth(Math.max(1.2, r * 0.16))
    .lineCap('round')
    .lineJoin('round')
    .strokeColor(color)
    .moveTo(cx - r * 0.42, cy + r * 0.02)
    .lineTo(cx - r * 0.1, cy + r * 0.34)
    .lineTo(cx + r * 0.46, cy - r * 0.3)
    .stroke()
    .restore();
}

/**
 * Arabic text support.
 *
 * The standard PDF fonts are Latin-only, so an Arabic learner name, course or academy
 * title came out as empty boxes or nonsense. Noto Sans Arabic (SIL OFL) is shipped as a
 * dependency and used for any field containing Arabic; `rtla` makes fontkit lay the
 * shaped glyphs out right-to-left.
 */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
let arabicFontDir: string | null | undefined;
function arabicFontFile(bold: boolean): string | null {
  if (arabicFontDir === undefined) {
    try {
      // The package's `exports` only expose CSS, so resolve a file it does export and
      // walk to the font folder from there.
      const license = require.resolve('@fontsource/noto-sans-arabic/LICENSE');
      arabicFontDir = path.join(path.dirname(license), 'files');
    } catch {
      arabicFontDir = null;
    }
  }
  if (!arabicFontDir) return null;
  const file = path.join(arabicFontDir, `noto-sans-arabic-arabic-${bold ? 700 : 400}-normal.woff`);
  return fs.existsSync(file) ? file : null;
}
export function hasArabic(value: string): boolean {
  return ARABIC.test(value);
}

/** Y of the classic layout's top seal; the heading sits below it. */
const CLASSIC_SEAL_Y = 58;

type TextRun = { text: string; font: string; rtl: boolean };

/**
 * Split text into same-script runs.
 *
 * The Arabic font has no Latin letters and the standard fonts have no Arabic, so a
 * course title like "أساسيات CNC" needs each part drawn in its own font. Spaces and
 * punctuation stay with the run they follow.
 */
export function scriptRuns(value: string, latinFont: string, bold: boolean): TextRun[] {
  const arabicFont = hasArabic(value) ? arabicFontFile(bold) : null;
  if (!arabicFont) return [{ text: value, font: latinFont, rtl: false }];
  const runs: TextRun[] = [];
  for (const ch of value) {
    const isArabic = ARABIC.test(ch);
    const isLatin = /[A-Za-z0-9\u00C0-\u024F]/.test(ch);
    const last = runs[runs.length - 1];
    if (!last) {
      // A leading space or mark opens an Arabic run: the line is right-to-left anyway.
      const rtl = isArabic || !isLatin;
      runs.push({ text: ch, font: rtl ? arabicFont : latinFont, rtl });
    } else if ((isArabic && !last.rtl) || (isLatin && last.rtl)) {
      runs.push({ text: ch, font: isArabic ? arabicFont : latinFont, rtl: isArabic });
    } else {
      last.text += ch;
    }
  }
  return runs;
}

function runOptions(run: TextRun) {
  return run.rtl ? { features: ['rtla'] as PDFKit.Mixins.OpenTypeFeatures[], lineBreak: false } : { lineBreak: false };
}

function measureRuns(doc: PDFKit.PDFDocument, runs: TextRun[], size: number): number {
  let total = 0;
  for (const run of runs) total += doc.font(run.font).fontSize(size).widthOfString(run.text, runOptions(run));
  return total;
}

/**
 * Draw runs centred on `cx`.
 *
 * Text containing Arabic is laid out right-to-left: the first logical run sits on the
 * right. Pure Latin text is a single run, so it is unaffected.
 */
function drawRuns(doc: PDFKit.PDFDocument, runs: TextRun[], cx: number, top: number, size: number, color: string) {
  const total = measureRuns(doc, runs, size);
  const rtlLine = runs.some((r) => r.rtl);
  let cursor = rtlLine ? cx + total / 2 : cx - total / 2;
  doc.fillColor(color);
  for (const run of runs) {
    const w = doc.font(run.font).fontSize(size).widthOfString(run.text, runOptions(run));
    const left = rtlLine ? cursor - w : cursor;
    // No `width`: with one, PDFKit still breaks at hyphens even with `lineBreak: false`.
    // Every run shares one alphabetic baseline, so Latin inside Arabic does not float
    // above it (the two fonts have different ascents).
    doc.text(run.text, left, top + size * 0.8, { ...runOptions(run), baseline: 'alphabetic' });
    cursor = rtlLine ? cursor - w : cursor + w;
  }
}

/** Public verification URL printed on the certificate, e.g. `barootcnc.com/verify/TMF-…`. */
export function verificationLabel(certificateNumber: string, siteUrl = process.env.FRONTEND_URL): string {
  const host = (siteUrl || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return host ? `${host}/verify/${certificateNumber}` : `Certificate no. ${certificateNumber}`;
}

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
      // Centred seal, above the heading. It used to sit at y=96 with a 26pt radius,
      // straight across the heading line at y=74.
      doc.circle(PAGE_WIDTH / 2, CLASSIC_SEAL_Y, 20).fill(primary);
      drawCheck(doc, PAGE_WIDTH / 2, CLASSIC_SEAL_Y, 20, '#FFFFFF');
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
      .text((template.name || 'Certificate of Completion').toUpperCase(), 0, layout === 'classic' ? 94 : 74, {
        width: PAGE_WIDTH,
        align: 'center',
        characterSpacing: 2.2,
      });

    // Designer fields. The Studio canvas anchors each field at its CENTRE
    // (`left: x%; top: y%; transform: translate(-50%, -50%)`), so the text box here is
    // centred on the anchor too. It used to start AT the anchor and run 90% of the page
    // wide, which pushed every centred field half a page to the right and clipped it.
    for (const field of fields) {
      const x = (Math.min(Math.max(field.x, 0), 100) / 100) * PAGE_WIDTH;
      const y = (Math.min(Math.max(field.y, 0), 100) / 100) * PAGE_HEIGHT;
      const weight = String(field.fontWeight);
      const bold = weight === '700' || weight === 'bold' || weight === '600';
      // The canvas sizes text at `fontSize / 64 * 10` container-width units, i.e.
      // fontSize / 640 of the page width. Matching that keeps the PDF looking like
      // the preview the admin approved.
      let size = Math.min(Math.max(field.fontSize * DESIGNER_SCALE, 6), 120);
      // Widest box that stays centred on the anchor and inside the page margins.
      const half = Math.max(Math.min(x, PAGE_WIDTH - x) - FIELD_MARGIN, 40);
      const latin = bold ? 'Helvetica-Bold' : baseFont;
      const runs = scriptRuns(field.value, latin, bold);
      // Shrink long names and titles to fit on one line instead of wrapping or clipping.
      const natural = measureRuns(doc, runs, size);
      if (natural > half * 2) size = Math.max(6, size * ((half * 2) / natural));
      drawRuns(doc, runs, x, y - size * 0.6, size, safeColor(field.color, '#191B1F'));
    }

    // Footer: signature line, seal, date. Kept clear of the classic and minimal frames.
    const footerY = PAGE_HEIGHT - 80;
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

    // Seal
    doc.circle(PAGE_WIDTH / 2, footerY + 6, 15).fill(primary);
    drawCheck(doc, PAGE_WIDTH / 2, footerY + 6, 15, '#FFFFFF');

    // Verification line: the number is the public verification handle, so print it
    // with the address that checks it. Was "Verify at <tenant name> · <number>",
    // which named no place to verify.
    doc
      .fillColor('#94A3B8')
      .font('Helvetica')
      .fontSize(6.5)
      .text(`Verify at ${verificationLabel(variables.certificateNumber)}`, 0, footerY + 30, {
        width: PAGE_WIDTH,
        align: 'center',
      });

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
