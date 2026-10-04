'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Award, Download, ExternalLink, Loader2, ShieldCheck, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-certifications'],
    queryFn: () =>
      fetch('/api/proxy/certifications/my', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('load');
        return r.json();
      }),
  });

  const download = async (id: string, certificateNumber: string) => {
    setDownloading(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/certifications/my/${id}/download`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Name the file from the certificate number we already hold. The
      // server's Content-Disposition is authoritative, but the Next proxy does
      // not forward it, so a header-based name silently degraded to the row id.
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? `certificate-${certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? t('downloadFailed', { default: 'Download failed' }));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  const certs: MyCertificate[] = Array.isArray(data) ? data : [];

  if (certs.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border bg-card p-10 text-center',
          className,
        )}
      >
        <Award className="mx-auto mb-3 size-9 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
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
    <div className={cn('space-y-3', className)}>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {certs.map((cert) => {
        const revoked = Boolean(cert.revokedAt);
        return (
          <article
            key={cert.id}
            className={cn(
              'flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs transition sm:flex-row sm:items-center',
              revoked ? 'border-destructive/30 opacity-80' : 'border-border hover:border-border-strong',
            )}
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl',
                revoked ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
              )}
            >
              {revoked ? <Ban className="size-5" /> : <Award className="size-5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate text-13 font-semibold text-foreground">
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
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                <ExternalLink className="size-3.5" />
                {t('verify', { default: 'Verify' })}
              </a>
              {revoked ? (
                <span className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground">
                  {t('revoked', { default: 'Revoked' })}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void download(cert.id, cert.certificateNumber)}
                  disabled={downloading === cert.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-60"
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
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
