'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Loader2,
  ShieldX,
  RotateCcw,
  FileText,
  Fingerprint,
  Award,
  Copy,
  Link2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
export interface CertificateRow {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason?: string | null;
  pdfUrl?: string | null;
  pdfStorageKey?: string | null;
  source?: 'automatic' | 'manual' | null;
  academyId?: string | null;
  templateId?: string | null;
  payload?: { usedDefaultLayout?: boolean; fields?: { key: string; value: string }[] } | null;
  metadata?: Record<string, unknown> | null;
  // flattened joins returned by the admin list endpoint
  userId?: string;
  userName?: string | null;
  userEmail?: string;
  courseId?: string;
  courseTitle?: string;
}
interface CertificateDetail extends CertificateRow {
  metadata?: Record<string, unknown> | null;
  digitalSignature?: string | null;
  user: { id: string; name: string | null; email: string };
  course: { id: string; title: string; slug: string };
}
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      {' '}
      <dt className="shrink-0 text-muted-foreground">{label}</dt>{' '}
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>{' '}
    </div>
  );
}
export function CertificateDetailDialog({
  certificateId,
  onClose,
  onChanged,
}: {
  certificateId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const t = useTranslations('admin.certificateDetail');
  const tCommon = useTranslations('common');
  const [cert, setCert] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [reissueArmed, setReissueArmed] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !revokeOpen && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, revokeOpen]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/certifications/${certificateId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load certificate (${res.status})`);
      setCert(await res.json());
    } catch (e: any) {
      setError(e?.message || t('loadFailed', { default: 'Failed to load' }));
    } finally {
      setLoading(false);
    }
  }, [certificateId]);
  useEffect(() => {
    load();
  }, [load]);
  const isRevoked = Boolean(cert?.revokedAt);
  const revoke = async () => {
    if (!cert) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/proxy/admin/certifications/${cert.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      onChanged(t('revoked', { default: 'Certificate revoked' }));
      setRevokeOpen(false);
      setReason('');
      load();
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('revokeFailed', { default: 'Revoke failed' }),
        description: e?.message,
      });
    } finally {
      setRevoking(false);
    }
  };
  const reissue = async () => {
    if (!cert) return;
    if (!reissueArmed) {
      setReissueArmed(true);
      return;
    }
    setReissuing(true);
    try {
      const res = await fetch(`/api/proxy/admin/certifications/${cert.id}/reissue`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
      toast({
        type: 'ok',
        title: t('reissued', { default: 'Certificate reissued' }),
        description: t('newNumber', {
          number: data?.certificateNumber ?? '—',
          default: 'New number: {number}',
        }),
      });
      setReissueArmed(false);
      onChanged(t('reissued', { default: 'Certificate reissued' }));
      onClose();
    } catch (e: any) {
      toast({
        type: 'err',
        title: t('reissueFailed', { default: 'Reissue failed' }),
        description: e?.message,
      });
      setReissueArmed(false);
    } finally {
      setReissuing(false);
    }
  };
  return (
    <>
      {' '}
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        {' '}
        <DialogContent className="max-w-md">
          {' '}
          <button
            type="button"
            onClick={onClose}
            className="absolute end-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            aria-label={tCommon('close', { default: 'Close' })}
          >
            {' '}
            <X className="size-4" />{' '}
          </button>{' '}
          <DialogHeader>
            {' '}
            <DialogTitle className="flex items-center gap-2">
              {' '}
              <Award className="size-5 text-primary" />{' '}
              {t('title', { default: 'Certificate details' })}{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          {loading ? (
            <div className="space-y-3 py-4">
              {' '}
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 rounded" />
              ))}{' '}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-destructive/5 px-4 py-3">
              {' '}
              <p className="text-sm text-destructive dark:text-destructive">{error}</p>{' '}
              <button type="button" onClick={load} className="mt-1 text-sm font-medium underline">
                {' '}
                {tCommon('retry', { default: 'Retry' })}{' '}
              </button>{' '}
            </div>
          ) : cert ? (
            <div className="space-y-5">
              {' '}
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                {' '}
                <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('certificateNumber', { default: 'Certificate number' })}
                </p>{' '}
                <p className="mt-0.5 font-mono text-base font-bold">{cert.certificateNumber}</p>{' '}
                <p className="mt-1 flex items-center justify-center gap-1 text-2xs text-muted-foreground">
                  {' '}
                  <Fingerprint className="size-3.5" />{' '}
                  {t('signature', { default: 'signature' })}{' '}
                  {cert.digitalSignature ? `${cert.digitalSignature.slice(0, 12)}…` : '—'}{' '}
                </p>{' '}
              </div>{' '}
              <dl className="space-y-2 rounded-xl border border-border p-3">
                {' '}
                <DetailRow label={t('user', { default: 'User' })}>
                  {cert.user.name || cert.user.email}
                </DetailRow>{' '}
                <DetailRow label={t('email', { default: 'Email' })}>{cert.user.email}</DetailRow>{' '}
                <DetailRow label={t('course', { default: 'Course' })}>
                  {cert.course.title}
                </DetailRow>{' '}
                <DetailRow label={t('issued', { default: 'Issued' })}>
                  {new Date(cert.issuedAt).toLocaleDateString()}
                </DetailRow>{' '}
                <DetailRow label={t('expires', { default: 'Expires' })}>
                  {cert.expiresAt
                    ? new Date(cert.expiresAt).toLocaleDateString()
                    : t('never', { default: 'Never' })}
                </DetailRow>{' '}
                <DetailRow label={t('source', { default: 'Source' })}>
                  {cert.source === 'manual'
                    ? t('sourceManual', { default: 'Manual (admin)' })
                    : t('sourceAutomatic', { default: 'Automatic (completion)' })}
                </DetailRow>
                <DetailRow label={t('document', { default: 'Document' })}>
                  {cert.pdfStorageKey || cert.pdfUrl ? (
                    <a
                      href={`/api/proxy/admin/certifications/${cert.id}/download`}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Download className="size-3.5" />
                      {t('downloadPdf', { default: 'Download PDF' })}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('noDocument', { default: 'Not generated yet' })}
                    </span>
                  )}
                </DetailRow>
                {/* The payload snapshot is what the PDF was drawn from. Showing
                    it makes an issued certificate auditable: an admin can see
                    the exact values and whether the default layout was used,
                    even after the template has been edited. */}
                {cert.payload?.fields?.length ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('renderedFields', { default: 'Rendered fields (immutable snapshot)' })}
                    </p>
                    {cert.payload.usedDefaultLayout && (
                      <p className="mt-1 text-2xs text-warning">
                        {t('usedDefaultLayout', {
                          default: 'Template had no fields, so the built-in layout was used.',
                        })}
                      </p>
                    )}
                    <dl className="mt-2 space-y-1">
                      {cert.payload.fields.map((f) => (
                        <div key={f.key} className="flex items-baseline gap-2 text-2xs">
                          <dt className="shrink-0 font-mono text-muted-foreground">{f.key}</dt>
                          <dd className="truncate font-medium text-foreground">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
                <DetailRow label={t('status', { default: 'Status' })}>
                  {' '}
                  {isRevoked ? (
                    <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-2xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-100">
                      {t('statusRevoked', { default: 'Revoked' })}
                    </span>
                  ) : cert.expiresAt && new Date(cert.expiresAt).getTime() <= Date.now() ? (
                    <span className="rounded-md bg-warning/10 px-2 py-0.5 text-2xs font-semibold text-warning  ">
                      {t('statusExpired', { default: 'Expired' })}
                    </span>
                  ) : (
                    <span className="rounded-md bg-success/10 px-2 py-0.5 text-2xs font-semibold text-success  ">
                      {t('statusActive', { default: 'Active' })}
                    </span>
                  )}{' '}
                </DetailRow>{' '}
                <DetailRow label={t('source', { default: 'Source' })}>
                  {' '}
                  {(() => {
                    const src = (cert.metadata as any)?.source as string | undefined;
                    if (src === 'automatic')
                      return (
                        <span className="rounded-md bg-primary/20 px-2 py-0.5 text-2xs font-semibold text-primary">
                          {t('sourceAutomatic', { default: 'Automatic' })}
                        </span>
                      );
                    if (src === 'manual')
                      return (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
                          {t('sourceManual', { default: 'Manual' })}
                        </span>
                      );
                    if (src)
                      return (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold capitalize">
                          {src}
                        </span>
                      );
                    return <span className="text-muted-foreground">—</span>;
                  })()}{' '}
                </DetailRow>{' '}
                {isRevoked && cert.revokedReason && (
                  <DetailRow label={t('reason', { default: 'Reason' })}>
                    {cert.revokedReason}
                  </DetailRow>
                )}{' '}
                {!isRevoked &&
                  cert.revokedAt === null &&
                  typeof cert.metadata?.reissuedFrom === 'string' && (
                    <DetailRow label={t('reissuedFrom', { default: 'Reissued from' })}>
                      {' '}
                      <code className="font-mono text-xs">
                        {String(cert.metadata.reissuedFrom)}
                      </code>{' '}
                    </DetailRow>
                  )}{' '}
              </dl>{' '}
              {cert.pdfUrl && (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {' '}
                  <FileText className="size-3.5" /> {t('viewPdf', { default: 'View PDF' })}{' '}
                </a>
              )}{' '}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                {' '}
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />{' '}
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{`${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${cert.certificateNumber}`}</code>{' '}
                <button
                  type="button"
                  onClick={async () => {
                    const link = `${window.location.origin}/verify/${cert.certificateNumber}`;
                    try {
                      await navigator.clipboard.writeText(link);
                      toast({
                        type: 'ok',
                        title: t('linkCopied', { default: 'Verification link copied' }),
                      });
                    } catch {
                      toast({
                        type: 'err',
                        title: t('copyFailed', { default: 'Copy failed' }),
                      });
                    }
                  }}
                  className="shrink-0 rounded-md border border-border bg-card p-1.5 hover:bg-muted"
                  aria-label={t('copyVerificationLinkAria', { default: 'Copy verification link' })}
                >
                  {' '}
                  <Copy className="size-3.5" />{' '}
                </button>{' '}
              </div>{' '}
              {!isRevoked ? (
                <button
                  type="button"
                  onClick={() => setRevokeOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 dark:text-destructive"
                >
                  {' '}
                  <ShieldX className="size-4" />{' '}
                  {t('revoke', { default: 'Revoke certificate' })}{' '}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={reissue}
                  disabled={reissuing}
                  onBlur={() => setReissueArmed(false)}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50',
                    reissueArmed
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-primary/40 text-primary hover:bg-primary/10 ',
                  )}
                >
                  {' '}
                  {reissuing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}{' '}
                  {reissuing
                    ? t('reissuing', { default: 'Reissuing…' })
                    : reissueArmed
                      ? t('confirmReissue', { default: 'Click again to confirm reissue' })
                      : t('reissueReplacement', { default: 'Reissue replacement' })}{' '}
                </button>
              )}{' '}
            </div>
          ) : null}{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
      {/* Revoke reason dialog */}{' '}
      <Dialog open={revokeOpen} onOpenChange={(v) => !v && setRevokeOpen(false)}>
        {' '}
        <DialogContent className="max-w-sm">
          {' '}
          <DialogHeader>
            {' '}
            <DialogTitle className="flex items-center gap-2 text-destructive dark:text-destructive">
              {' '}
              <ShieldX className="size-5" /> {t('revoke', { default: 'Revoke certificate' })}{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          <p className="text-sm text-muted-foreground">
            {' '}
            <span className="font-mono font-medium text-foreground">
              {cert?.certificateNumber}
            </span>{' '}
            {t('revokeWarning', {
              default: 'will be marked revoked and should no longer be honored.',
            })}{' '}
          </p>{' '}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('reasonPlaceholder', { default: 'Reason (stored on the record)…' })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />{' '}
          <div className="flex justify-end gap-2">
            {' '}
            <button
              type="button"
              onClick={() => setRevokeOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              {' '}
              {tCommon('cancel', { default: 'Cancel' })}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={revoke}
              disabled={revoking}
              className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            >
              {' '}
              {revoking && <Loader2 className="size-4 animate-spin" />}{' '}
              {t('revoke', { default: 'Revoke' })}{' '}
            </button>{' '}
          </div>{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
    </>
  );
}
