import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  renderCertificatePdf,
  scriptRuns,
  verificationLabel,
  hasArabic,
  type CertificateStyle,
} from '../src/modules/certification/certificate-renderer';
import { CertificationService } from '../src/modules/certification/certification.service';

/**
 * Printing a certificate.
 *
 * Covers the defects that made the PDF unusable: every centred field was drawn starting at
 * its anchor (half a page to the right, clipped), the seal printed a stray glyph, Arabic
 * text had no font, the verify line named no address, and a missing stored file meant no
 * document at all.
 */
const style: CertificateStyle = {
  id: null,
  name: 'Certificate of Completion',
  layout: 'modern',
  primaryColor: '#0E7490',
  secondaryColor: '#0a1628',
  logoUrl: null,
  backgroundUrl: null,
  fontFamily: 'Inter',
  fields: [],
  scopeType: 'tenant',
};
const vars = {
  learnerName: 'Bob Learner',
  courseTitle: 'CNC Milling Fundamentals',
  academyName: 'CNC Machining Academy',
  issueDate: 'November 11, 2026',
  certificateNumber: 'TMF-2026-000001',
  tenantName: 'Baroot',
};
const source = readFileSync(
  resolve(__dirname, '../src/modules/certification/certificate-renderer.ts'),
  'utf8',
);

describe('certificate PDF rendering', () => {
  it('produces a PDF for every layout', async () => {
    for (const layout of ['modern', 'classic', 'minimal']) {
      const pdf = await renderCertificatePdf({ ...style, layout }, vars);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('centres each field on its anchor, as the designer canvas does', () => {
    // The box must start half its width BEFORE the anchor, not at it.
    expect(source).toMatch(/Math\.min\(x, PAGE_WIDTH - x\) - FIELD_MARGIN/);
    expect(source).toMatch(/drawRuns\(doc, runs, x,/);
    expect(source).not.toMatch(/width: PAGE_WIDTH \* 0\.9/);
  });

  it('draws the check mark as a path, not a glyph the standard fonts lack', () => {
    expect(source).not.toMatch(/\.text\('✓'/);
    expect(source).toMatch(/drawCheck\(doc/);
  });

  it('prints an address learners and employers can verify at', () => {
    expect(verificationLabel('TMF-1', 'https://barootcnc.com/')).toBe('barootcnc.com/verify/TMF-1');
    expect(verificationLabel('TMF-1', '')).toBe('Certificate no. TMF-1');
  });

  it('embeds an Arabic font for Arabic names and keeps Latin runs in a Latin font', async () => {
    expect(hasArabic('محمد')).toBe(true);
    expect(hasArabic('Bob')).toBe(false);
    const runs = scriptRuns('أساسيات CNC', 'Helvetica', false);
    expect(runs.map((r) => r.rtl)).toEqual([true, false]);
    expect(runs[1].font).toBe('Helvetica');
    expect(runs[0].font).toMatch(/noto-sans-arabic-arabic-400-normal\.woff$/);

    const pdf = await renderCertificatePdf(style, { ...vars, learnerName: 'محمد عبد الله' });
    expect(pdf.toString('latin1')).toMatch(/NotoSansArabic/);
  });

  it('shrinks an overlong name to one line instead of wrapping it', async () => {
    const pdf = await renderCertificatePdf(style, {
      ...vars,
      learnerName: 'Maximilian Alexander Konstantin von Wittelsbach-Hohenzollern the Third',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(source).toMatch(/if \(natural > half \* 2\) size =/);
  });
});

describe('certificate document loading', () => {
  const cert = {
    id: 'c1',
    tenantId: 't1',
    certificateNumber: 'TMF-1',
    pdfStorageKey: 'tenants/t1/certificates/TMF-1.pdf',
    pdfUrl: null,
    revokedAt: null,
  } as any;

  function service(stored: Buffer | null | Error, render: 'ok' | 'fail' = 'ok') {
    const svc = Object.create(CertificationService.prototype) as any;
    svc.logger = { warn: vi.fn(), error: vi.fn() };
    svc.renderer = {};
    svc.storage = {
      getObjectBytes: vi.fn(async () => {
        if (stored instanceof Error) throw stored;
        return stored;
      }),
    };
    svc.renderRecord = vi.fn(async () => {
      if (render === 'fail') throw new Error('renderer down');
      return { buffer: Buffer.from('%PDF-fresh') };
    });
    return svc;
  }

  it('draws the document fresh, so certificates stored by an older renderer print correctly', async () => {
    const svc = service(Buffer.from('%PDF-stored-by-old-renderer'));
    expect(String(await svc.loadDocument(cert))).toBe('%PDF-fresh');
    expect(svc.storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('works when storage is down or the stored copy is gone', async () => {
    for (const stored of [null, new Error('Project paused')]) {
      expect(String(await service(stored).loadDocument(cert))).toBe('%PDF-fresh');
    }
  });

  it('falls back to the stored copy if rendering fails', async () => {
    const svc = service(Buffer.from('%PDF-stored'), 'fail');
    expect(String(await svc.loadDocument(cert))).toBe('%PDF-stored');
  });

  it('never yields a document for a revoked certificate, even one stored before the revoke', async () => {
    const svc = service(Buffer.from('%PDF-stored'));
    expect(await svc.loadDocument({ ...cert, revokedAt: new Date() })).toBeNull();
    expect(svc.renderRecord).not.toHaveBeenCalled();
    expect(svc.storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('emails a verification link to the page that exists', () => {
    const svcSource = readFileSync(
      resolve(__dirname, '../src/modules/certification/certification.service.ts'),
      'utf8',
    );
    expect(svcSource).not.toMatch(/\/certificates\/verify\//);
    expect(svcSource).toMatch(/\/verify\/\$\{encodeURIComponent\(cert\.certificateNumber\)\}/);
  });
});
