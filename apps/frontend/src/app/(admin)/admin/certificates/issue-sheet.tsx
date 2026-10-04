'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Modal, ModalHeader } from '@/components/ui/modal';
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
  courseId?: string | null;
}
interface UserOption {
  id: string;
  name: string | null;
  email: string;
}
export function IssueCertificateSheet({ open, onClose, onIssued }: IssueSheetProps) {
  const t = useTranslations('admin.certificateIssue');
  const tCommon = useTranslations('common');
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
      .then((d) =>
        setTemplates(
          (d?.items ?? []).map((t: any) => ({ id: t.id, name: t.name, courseId: t.courseId })),
        ),
      )
      .catch(() => {});
  }, [open]);
  const visibleTemplates = templates.filter(
    (t) => !courseId || !t.courseId || t.courseId === courseId,
  );
  useEffect(() => {
    setTemplateId('');
  }, [courseId]);
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
      toast({
        type: 'err',
        title: t('selectLearnerAndCourse', { default: 'Select learner and course' }),
      });
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
        title: t('issued', { default: 'Certificate issued' }),
        description: data?.certificateNumber
          ? t('numberLabel', { number: data.certificateNumber, default: 'Number: {number}' })
          : undefined,
      });
      onIssued();
      onClose();
      setSelectedUserId('');
      setSelectedUserLabel('');
      setCourseId('');
      setTemplateId('');
      setExpiresAt('');
    } catch (e: any) {
      toast({ type: 'err', title: t('issueFailed', { default: 'Issue failed' }), description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };
  if (!open) return null;
  return (
    <Modal
      onClose={onClose}
      title={t('title', { default: 'Issue certificate' })}
      header={
        <ModalHeader
          loading={false}
          initials="IC"
          gradient="bg-foreground text-background"
          title={t('title', { default: 'Issue certificate' })}
          subtitle={t('subtitle', { default: 'Manually award a certificate' })}
          onClose={onClose}
        />
      }
    >
      {' '}
      <div className="space-y-5 p-6">
        {' '}
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 flex gap-2">
          {' '}
          <AlertTriangle className="size-4 shrink-0 text-warning dark:text-warning mt-0.5" />{' '}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {' '}
            {t('manualIssueHintPrefix', { default: 'Manual issue works' })}{' '}
            <span className="font-medium text-foreground">
              {t('manualIssueHintStrong', {
                default: 'even if the learner hasn&apos;t completed the course',
              })}
            </span>
            . {t('manualIssueHintSuffix', {
              default: 'The enrollment will be marked completed.',
            })}{' '}
          </p>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>{t('learner', { default: 'Learner *' })}</label>{' '}
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
                {t('change', { default: 'Change' })}{' '}
              </button>{' '}
            </div>
          ) : (
            <div className="relative">
              {' '}
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />{' '}
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={t('searchPlaceholder', { default: 'Search by name or email…' })}
                className={INPUT + ' ps-9'}
              />{' '}
              {userSearching && (
                <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}{' '}
              {userOptions.length > 0 && (
                <div className="absolute start-0 end-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
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
          <label className={LABEL}>{t('course', { default: 'Course *' })}</label>{' '}
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={INPUT}>
            {' '}
            <option value="">{t('selectCourse', { default: 'Select a course…' })}</option>{' '}
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
            {t('template', { default: 'Template' })}{' '}
            <span className="font-normal normal-case text-muted-foreground">
              {t('optional', { default: '(optional)' })}
            </span>
          </label>{' '}
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={INPUT}
          >
            {' '}
            <option value="">{t('default', { default: 'Default' })}</option>{' '}
            {visibleTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {' '}
                {tpl.name}
                {tpl.courseId ? '' : ` · ${t('tenantDefault', { default: 'tenant default' })}`}{' '}
              </option>
            ))}{' '}
          </select>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>
            {t('expiresAt', { default: 'Expires at' })}{' '}
            <span className="font-normal normal-case text-muted-foreground">
              {t('optional', { default: '(optional)' })}
            </span>
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
            {tCommon('cancel', { default: 'Cancel' })}{' '}
          </button>{' '}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedUserId || !courseId}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {' '}
            {submitting && <Loader2 className="size-4 animate-spin" />}{' '}
            {t('title', { default: 'Issue certificate' })}{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
    </Modal>
  );
}
