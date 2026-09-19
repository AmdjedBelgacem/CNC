'use client';
import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
      setError(e?.message || 'Failed to load');
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
      onChanged('Certificate revoked');
      setRevokeOpen(false);
      setReason('');
      load();
    } catch (e: any) {
      toast({ type: 'err', title: 'Revoke failed', description: e?.message });
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
        title: 'Certificate reissued',
        description: `New number: ${data?.certificateNumber ?? '—'}`,
      });
      setReissueArmed(false);
      onChanged('Certificate reissued');
      onClose();
    } catch (e: any) {
      toast({ type: 'err', title: 'Reissue failed', description: e?.message });
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
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            aria-label="Close"
          >
            {' '}
            <X className="h-4 w-4" />{' '}
          </button>{' '}
          <DialogHeader>
            {' '}
            <DialogTitle className="flex items-center gap-2">
              {' '}
              <Award className="h-5 w-5 text-primary" /> Certificate details{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          {loading ? (
            <div className="space-y-3 py-4">
              {' '}
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-muted" />
              ))}{' '}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
              {' '}
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>{' '}
              <button type="button" onClick={load} className="mt-1 text-sm font-medium underline">
                {' '}
                Retry{' '}
              </button>{' '}
            </div>
          ) : cert ? (
            <div className="space-y-5">
              {' '}
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                {' '}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Certificate number
                </p>{' '}
                <p className="mt-0.5 font-mono text-base font-bold">{cert.certificateNumber}</p>{' '}
                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  {' '}
                  <Fingerprint className="h-3 w-3" /> signature{' '}
                  {cert.digitalSignature ? `${cert.digitalSignature.slice(0, 12)}…` : '—'}{' '}
                </p>{' '}
              </div>{' '}
              <dl className="space-y-2 rounded-xl border border-border p-3">
                {' '}
                <DetailRow label="User">{cert.user.name || cert.user.email}</DetailRow>{' '}
                <DetailRow label="Email">{cert.user.email}</DetailRow>{' '}
                <DetailRow label="Course">{cert.course.title}</DetailRow>{' '}
                <DetailRow label="Issued">{new Date(cert.issuedAt).toLocaleDateString()}</DetailRow>{' '}
                <DetailRow label="Expires">
                  {cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : 'Never'}
                </DetailRow>{' '}
                <DetailRow label="Status">
                  {' '}
                  {isRevoked ? (
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900 dark:text-red-100">
                      Revoked
                    </span>
                  ) : cert.expiresAt && new Date(cert.expiresAt).getTime() <= Date.now() ? (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                      Expired
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                      Active
                    </span>
                  )}{' '}
                </DetailRow>{' '}
                <DetailRow label="Source">
                  {' '}
                  {(() => {
                    const src = (cert.metadata as any)?.source as string | undefined;
                    if (src === 'automatic')
                      return (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          Automatic
                        </span>
                      );
                    if (src === 'manual')
                      return (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Manual
                        </span>
                      );
                    if (src)
                      return (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
                          {src}
                        </span>
                      );
                    return <span className="text-muted-foreground">—</span>;
                  })()}{' '}
                </DetailRow>{' '}
                {isRevoked && cert.revokedReason && (
                  <DetailRow label="Reason">{cert.revokedReason}</DetailRow>
                )}{' '}
                {!isRevoked &&
                  cert.revokedAt === null &&
                  typeof cert.metadata?.reissuedFrom === 'string' && (
                    <DetailRow label="Reissued from">
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
                  <FileText className="h-3.5 w-3.5" /> View PDF{' '}
                </a>
              )}{' '}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                {' '}
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{' '}
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{`${typeof window !== 'undefined' ? window.location.origin : ''}/certificates/verify/${cert.certificateNumber}`}</code>{' '}
                <button
                  type="button"
                  onClick={async () => {
                    const link = `${window.location.origin}/certificates/verify/${cert.certificateNumber}`;
                    try {
                      await navigator.clipboard.writeText(link);
                      toast({ type: 'ok', title: 'Verification link copied' });
                    } catch {
                      toast({ type: 'err', title: 'Copy failed' });
                    }
                  }}
                  className="shrink-0 rounded-md border border-border bg-card p-1.5 hover:bg-muted"
                  aria-label="Copy verification link"
                >
                  {' '}
                  <Copy className="h-3.5 w-3.5" />{' '}
                </button>{' '}
              </div>{' '}
              {!isRevoked ? (
                <button
                  type="button"
                  onClick={() => setRevokeOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                >
                  {' '}
                  <ShieldX className="h-4 w-4" /> Revoke certificate{' '}
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
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-blue-500/40 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400',
                  )}
                >
                  {' '}
                  {reissuing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}{' '}
                  {reissuing
                    ? 'Reissuing…'
                    : reissueArmed
                      ? 'Click again to confirm reissue'
                      : 'Reissue replacement'}{' '}
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
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              {' '}
              <ShieldX className="h-5 w-5" /> Revoke certificate{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          <p className="text-sm text-muted-foreground">
            {' '}
            <span className="font-mono font-medium text-foreground">
              {cert?.certificateNumber}
            </span>{' '}
            will be marked revoked and should no longer be honored.{' '}
          </p>{' '}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Reason (stored on the record)…"
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
              Cancel{' '}
            </button>{' '}
            <button
              type="button"
              onClick={revoke}
              disabled={revoking}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {' '}
              {revoking && <Loader2 className="h-4 w-4 animate-spin" />} Revoke{' '}
            </button>{' '}
          </div>{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
    </>
  );
}
