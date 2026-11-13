'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import { m } from 'framer-motion';
import { ease } from '@/lib/motion';
import { Crossfade } from '@/components/ui/motion';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { StatusPill, type Tone } from '@/components/admin/admin-ui';
import { TextAreaField } from '@/components/admin/admin-form';
import { DiscardChangesDialog, useDirtyClose } from '@/components/admin/drawer-kit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PartnerApplicationsSkeleton } from '@/components/skeletons/admin-route-skeletons';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { SkeletonRegion } from '@/components/ui/skeletons';

const ACTION =
  'rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98]';

const PARTNER_TONE: Record<string, Tone> = {
  pending: 'amber',
  under_review: 'cyan',
  approved: 'emerald',
  rejected: 'rose',
  needs_info: 'purple',
};

type ReviewAction = { id: string; company: string; kind: 'reject' | 'request-info' };

/**
 * Reject / request-info need a written reason or message, which used to be a
 * browser `prompt()`. Submit stays disabled until there is text; closing with
 * text typed asks before discarding.
 */
function ReviewDialog({
  action,
  onSubmit,
  onClose,
}: {
  action: ReviewAction;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('admin.partnerReview');
  const tc = useTranslations('common');
  const [text, setText] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useDirtyClose(text.trim() !== '', onClose);
  const reject = action.kind === 'reject';
  const submit = async () => {
    setAttempted(true);
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSubmit(text.trim());
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Dialog open onOpenChange={(open) => !open && guard.requestClose()}>
        <DialogContent size="md" hideClose={false}>
          <DialogHeader>
            <DialogTitle>{reject ? t('rejectTitle') : t('infoTitle')}</DialogTitle>
            <DialogDescription>
              {action.company} · {reject ? t('rejectHint') : t('infoHint')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <TextAreaField
              label={reject ? t('reasonLabel') : t('messageLabel')}
              required
              rows={4}
              autoFocus
              value={text}
              error={attempted && !text.trim() ? t('required') : undefined}
              onChange={(e) => setText(e.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={guard.requestClose} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant={reject ? 'destructive' : 'default'}
              onClick={submit}
              loading={saving}
              disabled={saving}
            >
              {reject ? t('rejectAction') : t('sendRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog guard={guard} />
    </>
  );
}

// Approved and rejected are final on the server (see partners.service VALID_TRANSITIONS), so
// offering decisions on them only produced a 400 toast.
const OPEN_STATUSES = new Set(['pending', 'under_review', 'needs_info']);

export default function AdminPartnersPage() {
  const [items, setItems] = useState<any[]>([]);
  // Until the first response there is nothing to show; render the list's shape
  // instead of an empty page under the header.
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState<ReviewAction | null>(null);
  const [status, setStatus] = useState('all');
  // A failed request still ends in `loaded`, so only a successful one may be remembered.
  const [failed, setFailed] = useState(false);
  const load = () => {
    const q = status !== 'all' ? `?status=${status}` : '';
    api.get<any>(`/admin/partners/applications${q}`).then((d) => { setItems(Array.isArray(d?.items) ? d.items : []); setFailed(false); }).catch((e)=>{ setFailed(true); toast({type:'err',title:e?.message}); }).finally(() => setLoaded(true));
  };
  useEffect(load, [status]);

  // The loading skeleton draws one card per application listed here (none when empty); record
  // how many for the next visit. Only the "All" view, which is what a fresh visit opens on.
  useEffect(() => {
    if (loaded && !failed && status === 'all') rememberListCount('partners', items.length);
  }, [loaded, failed, status, items]);
  const act = async (id: string, action: 'approve'|'reject'|'request-info', payload?: any): Promise<boolean> => {
    try {
      await api.post(`/admin/partners/applications/${id}/${action}`, payload ?? {});
      toast({ type: 'ok', title: 'Done' });
      load();
      return true;
    } catch (e: any) {
      toast({ type: 'err', title: e?.message });
      return false;
    }
  };
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminPageHeader
        title="Partner applications"
        badge={
          <select
            className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm shadow-xs outline-none transition hover:border-border-strong focus:border-primary/50 focus:ring-[3px] focus:ring-primary/15 md:w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="needs_info">Needs info</option>
          </select>
        }
      />
      {!loaded && <SkeletonRegion><PartnerApplicationsSkeleton /></SkeletonRegion>}
      <Crossfade value={status} axis="none">
        <ul className="space-y-3">
          {items.map((a, index) => (
            <m.li
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: ease.emerge, delay: Math.min(index * 0.04, 0.4) }}
              className="space-y-2.5 rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-medium tracking-[-0.015em]">{a.companyName}</span>
                <StatusPill
                  label={String(a.status ?? '').replace(/_/g, ' ')}
                  tone={PARTNER_TONE[a.status as string] ?? 'slate'}
                />
              </div>
              <p className="text-xs text-muted-foreground">{a.contactName} · {a.email} · {a.type}</p>
              <p className="max-w-prose text-sm leading-relaxed">{a.message}</p>
              {OPEN_STATUSES.has(String(a.status)) ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button className={ACTION} onClick={()=>act(a.id,'approve',{})}>Approve</button>
                <button className={ACTION} onClick={()=>setReview({ id: a.id, company: a.companyName, kind: 'reject' })}>Reject</button>
                <button className={ACTION} onClick={()=>setReview({ id: a.id, company: a.companyName, kind: 'request-info' })}>Request info</button>
              </div>
              ) : null}
            </m.li>
          ))}
        </ul>
      </Crossfade>
      {review ? (
        <ReviewDialog
          key={review.id + review.kind}
          action={review}
          onClose={() => setReview(null)}
          onSubmit={async (text) => {
            const ok = await act(
              review.id,
              review.kind,
              review.kind === 'reject' ? { reason: text } : { message: text },
            );
            if (ok) setReview(null);
          }}
        />
      ) : null}
    </div>
  );
}
