'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Award, Download, ExternalLink, Loader2, Printer, ShieldCheck, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonRegion } from '@/components/ui/skeletons/region';
import { CertificateListSkeleton } from '@/components/ui/skeletons/public';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { transition } from '@/lib/motion';

/**
 * A learner's earned certificates.
 *
 * Each row links to the authorized download endpoint rather than a stored URL.
 * `pdfUrl` is a capability URL that expires, and a revoked certificate must stop
 * downloading, so the file is always fetched through the owner-checked route.
 */

export interface MyCertificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  source: 'automatic' | 'manual';
  pdfUrl: string | null;
  payload: { usedDefaultLayout?: boolean } | null;
  course?: { title?: string | null } | null;
}

export function CertificateList({ className }: { className?: string }) {
  const t = useTranslations('certificates.mine');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-certifications'],
    queryFn: () =>
      fetch('/api/proxy/certifications/my', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('load');
        return r.json();
      }),
  });

  // The /account skeleton draws as many certificate rows as this list last showed.
  useEffect(() => {
    if (!isLoading) rememberListCount('public-account-certificates', Array.isArray(data) ? data.length : 0);
  }, [isLoading, data]);

  const fetchPdf = async (id: string): Promise<Blob> => {
    const res = await fetch(`/api/proxy/certifications/my/${id}/download`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? `HTTP ${res.status}`);
    }
    return res.blob();
  };

  const download = async (id: string, certificateNumber: string) => {
    setDownloading(id);
    setError(null);
    try {
      const blob = await fetchPdf(id);
      // Named from the certificate number we already hold rather than the response
      // headers, which the Next proxy does not always forward.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ type: 'ok', title: t('downloadStarted') });
    } catch (e: any) {
      const message = e?.message ?? t('downloadFailed', { default: 'Download failed' });
      setError(message);
      toast({ type: 'err', title: t('downloadFailed'), description: message });
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Print the certificate without making the learner download and open it first.
   *
   * The PDF is loaded into an off-screen frame and that frame's print dialog is opened.
   * Browsers that cannot print a PDF frame (Safari, some mobile browsers) get the PDF
   * in a new tab instead, where their own print button works.
   */
  const print = async (id: string) => {
    setPrinting(id);
    setError(null);
    // Opened before the await so the browser treats it as part of the click and does
    // not block it as a pop-up; it is only used as the fallback.
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const fallback = isSafari ? window.open('', '_blank') : null;
    try {
      const blob = await fetchPdf(id);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (fallback) {
        fallback.location.href = url;
        return;
      }
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, '_blank', 'noopener');
        }
        // Long enough for the print dialog to have read the document.
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      };
      document.body.appendChild(frame);
    } catch (e: any) {
      fallback?.close();
      const message = e?.message ?? t('printFailed', { default: 'Could not open the certificate for printing' });
      setError(message);
      toast({ type: 'err', title: t('printFailed', { default: 'Could not open the certificate for printing' }), description: message });
    } finally {
      setPrinting(null);
    }
  };

  if (isLoading) {
    return (
      <SkeletonRegion>
        <CertificateListSkeleton className={className} />
      </SkeletonRegion>
    );
  }

  const certs: MyCertificate[] = Array.isArray(data) ? data : [];

  if (certs.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-border px-8 py-14 text-center',
          className,
        )}
      >
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Award className="size-5" />
        </span>
        <p className="font-display text-xl font-medium text-foreground">
          {t('emptyTitle', { default: 'No certificates yet' })}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {t('emptyBody', {
            default: 'Finish a course that issues a certificate and it will appear here.',
          })}
        </p>
      </div>
    );
  }

  return (
    <Stagger className={cn('space-y-3', className)}>
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.leave }}
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </m.p>
        )}
      </AnimatePresence>
      {certs.map((cert, index) => {
        const revoked = Boolean(cert.revokedAt);
        return (
          <StaggerItem
            as="article"
            key={cert.id}
            index={index}
            className={cn(
              'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow] sm:flex-row sm:items-center',
              revoked ? 'border-destructive/30 opacity-80' : 'border-border/70 hover:border-border-strong hover:shadow-sm',
            )}
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                revoked ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
              )}
            >
              {revoked ? <Ban className="size-5" /> : <Award className="size-5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate font-display text-lg font-medium text-foreground">
                {cert.course?.title || t('untitledCourse', { default: 'Course' })}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                <span dir="ltr" className="font-mono">
                  {cert.certificateNumber}
                </span>
                <span aria-hidden className="text-border-strong">
                  ·
                </span>
                <span>
                  {t('issuedOn', {
                    date: new Date(cert.issuedAt).toLocaleDateString(),
                    default: 'Issued {date}',
                  })}
                </span>
                {cert.source === 'automatic' && (
                  <>
                    <span aria-hidden className="text-border-strong">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="size-3" />
                      {t('automatic', { default: 'Auto-issued' })}
                    </span>
                  </>
                )}
              </div>
              {revoked && cert.revokedReason && (
                <p className="mt-1.5 text-2xs text-destructive">
                  {t('revokedReason', {
                    reason: cert.revokedReason,
                    default: 'Revoked: {reason}',
                  })}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/verify/${encodeURIComponent(cert.certificateNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:border-border-strong hover:bg-muted"
              >
                <ExternalLink className="size-3.5" />
                {t('verify', { default: 'Verify' })}
              </a>
              {revoked ? (
                <span className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-muted-foreground">
                  {t('revoked', { default: 'Revoked' })}
                </span>
              ) : (
                <>
                <button
                  type="button"
                  onClick={() => void print(cert.id)}
                  disabled={printing === cert.id}
                  aria-label={t('print', { default: 'Print' })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:border-border-strong hover:bg-muted disabled:opacity-60"
                >
                  {printing === cert.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Printer className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">{t('print', { default: 'Print' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void download(cert.id, cert.certificateNumber)}
                  disabled={downloading === cert.id}
                  aria-label={t('download', { default: 'Download PDF' })}
                  className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {downloading === cert.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {t('download', { default: 'Download PDF' })}
                  </span>
                </button>
                </>
              )}
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
