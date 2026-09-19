'use client';
import { useEffect, useState } from 'react';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { RightSheet, RightSheetHeader } from '@/components/ui/right-sheet';
import { INPUT, LABEL } from '../courses/studio/glass';
interface IssueSheetProps {
  open: boolean;
  onClose: () => void;
  onIssued: () => void;
}
interface CourseOption {
  id: string;
  title: string;
}
interface TemplateOption {
  id: string;
  name: string;
}
interface UserOption {
  id: string;
  name: string | null;
  email: string;
}
export function IssueCertificateSheet({ open, onClose, onIssued }: IssueSheetProps) {
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserLabel, setSelectedUserLabel] = useState('');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!open) return;
    fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setCourses((d?.items ?? []).map((c: any) => ({ id: c.id, title: c.title }))))
      .catch(() => {});
    fetch('/api/proxy/admin/cert-templates?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setTemplates((d?.items ?? []).map((t: any) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, [open]);
  useEffect(() => {
    if (!userQuery.trim()) {
      setUserOptions([]);
      return;
    }
    setUserSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/proxy/admin/users?limit=20&q=${encodeURIComponent(userQuery)}`,
          { credentials: 'include' },
        );
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setUserOptions(items.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
      } catch {
        setUserOptions([]);
      } finally {
        setUserSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);
  const handleSelectUser = (u: UserOption) => {
    setSelectedUserId(u.id);
    setSelectedUserLabel(u.name ? `${u.name} (${u.email})` : u.email);
    setUserQuery('');
    setUserOptions([]);
  };
  const handleSubmit = async () => {
    if (!selectedUserId || !courseId) {
      toast({ type: 'err', title: 'Select learner and course' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/proxy/admin/certifications/issue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          courseId,
          templateId: templateId || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
      toast({
        type: 'ok',
        title: 'Certificate issued',
        description: data?.certificateNumber ? `Number: ${data.certificateNumber}` : undefined,
      });
      onIssued();
      onClose();
      setSelectedUserId('');
      setSelectedUserLabel('');
      setCourseId('');
      setTemplateId('');
      setExpiresAt('');
    } catch (e: any) {
      toast({ type: 'err', title: 'Issue failed', description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };
  if (!open) return null;
  return (
    <RightSheet
      onClose={onClose}
      header={
        <RightSheetHeader
          loading={false}
          initials="IC"
          gradient="bg-foreground text-background"
          title="Issue certificate"
          subtitle="Manually award a certificate"
          onClose={onClose}
        />
      }
    >
      {' '}
      <div className="space-y-5 p-6">
        {' '}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex gap-2">
          {' '}
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />{' '}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {' '}
            Manual issue works{' '}
            <span className="font-medium text-foreground">
              even if the learner hasn&apos;t completed the course
            </span>
            . The enrollment will be marked completed.{' '}
          </p>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>Learner *</label>{' '}
          {selectedUserId ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              {' '}
              <span className="truncate text-sm font-medium">{selectedUserLabel}</span>{' '}
              <button
                type="button"
                onClick={() => {
                  setSelectedUserId('');
                  setSelectedUserLabel('');
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {' '}
                Change{' '}
              </button>{' '}
            </div>
          ) : (
            <div className="relative">
              {' '}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by name or email…"
                className={INPUT + ' pl-9'}
              />{' '}
              {userSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}{' '}
              {userOptions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                  {' '}
                  {userOptions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                    >
                      {' '}
                      <span className="truncate text-sm font-medium">
                        {u.name || u.email.split('@')[0]}
                      </span>{' '}
                      <span className="truncate text-xs text-muted-foreground">{u.email}</span>{' '}
                    </button>
                  ))}{' '}
                </div>
              )}{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>Course *</label>{' '}
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={INPUT}>
            {' '}
            <option value="">Select a course…</option>{' '}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {' '}
                {c.title}{' '}
              </option>
            ))}{' '}
          </select>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>
            Template{' '}
            <span className="font-normal normal-case text-muted-foreground">(optional)</span>
          </label>{' '}
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={INPUT}
          >
            {' '}
            <option value="">Default</option>{' '}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {' '}
                {t.name}{' '}
              </option>
            ))}{' '}
          </select>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>
            Expires at{' '}
            <span className="font-normal normal-case text-muted-foreground">(optional)</span>
          </label>{' '}
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={INPUT}
          />{' '}
        </div>{' '}
        <div className="flex justify-end gap-2 pt-2">
          {' '}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            {' '}
            Cancel{' '}
          </button>{' '}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedUserId || !courseId}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {' '}
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Issue certificate{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
    </RightSheet>
  );
}
