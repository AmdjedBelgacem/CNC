'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Loader2, Pencil, Plus, RefreshCw, Trash2, Video, X } from 'lucide-react';
import { Field, FormSection, TextField } from '@/components/admin/admin-form';
import { StatusPill } from '@/components/admin/admin-ui';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { CourseStudioData, LiveSession, LiveSessionStatus } from './types';
import * as api from './api';

const STATUS_TONE: Record<LiveSessionStatus, 'emerald' | 'amber' | 'slate' | 'rose'> = {
  scheduled: 'emerald',
  live: 'amber',
  draft: 'slate',
  completed: 'slate',
  cancelled: 'rose',
};

/** ISO string → value for <input type="datetime-local"> in the admin's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface DraftSession {
  id: string | null; // null = creating
  title: string;
  description: string;
  startsAt: string; // datetime-local value
  endsAt: string;
  timezone: string;
  capacity: string;
  meetUrl: string;
}

function emptyDraft(): DraftSession {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    id: null,
    title: '',
    description: '',
    startsAt: local(start),
    endsAt: local(end),
    timezone: safeTimeZone(),
    capacity: '',
    meetUrl: '',
  };
}

function safeTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function StepLive({ course }: { course: CourseStudioData }) {
  const t = useTranslations('courses.studio.live');
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await api.listLiveSessions(course.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('loadFailed', { default: 'Failed to load live sessions' }));
    } finally {
      setLoading(false);
    }
  }, [course.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => setDraft(emptyDraft());
  const openEdit = (session: LiveSession) => setDraft({
    id: session.id,
    title: session.title,
    description: session.description ?? '',
    startsAt: toLocalInput(session.startsAt),
    endsAt: toLocalInput(session.endsAt),
    timezone: session.timezone || 'UTC',
    capacity: session.capacity != null ? String(session.capacity) : '',
    meetUrl: session.meetUrl ?? '',
  });

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast({ type: 'err', title: t('titleRequired', { default: 'Title is required' }) });
      return;
    }
    const startsAt = new Date(draft.startsAt);
    const endsAt = new Date(draft.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      toast({ type: 'err', title: t('invalidTimes', { default: 'End time must be after the start time' }) });
      return;
    }
    if (draft.meetUrl && !/^https:\/\/meet\.google\.com\/[a-z0-9-]+\/?$/.test(draft.meetUrl)) {
      toast({ type: 'err', title: t('invalidMeetUrl', { default: 'The Meet link must look like https://meet.google.com/abc-defg-hij' }) });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: draft.timezone || 'UTC',
        capacity: draft.capacity ? Number(draft.capacity) : undefined,
        meetUrl: draft.meetUrl.trim() || undefined,
      };
      const result = draft.id
        ? await api.updateLiveSession(course.id, draft.id, body)
        : await api.createLiveSession(course.id, body);
      setDraft(null);
      await load();
      toast({ type: 'ok', title: draft.id ? t('saved', { default: 'Live session saved' }) : t('created', { default: 'Live session created' }) });
      if (result.warnings?.length) {
        toast({ type: 'err', title: t('overlapWarning', { default: 'Schedule overlap' }), description: result.warnings.join(' · ') });
      }
    } catch (saveError) {
      toast({ type: 'err', title: t('saveFailed', { default: 'Save failed' }), description: saveError instanceof Error ? saveError.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const act = async (session: LiveSession, action: 'publish' | 'cancel' | 'delete') => {
    setBusyId(session.id);
    try {
      if (action === 'publish') await api.publishLiveSession(course.id, session.id);
      else if (action === 'cancel') await api.cancelLiveSession(course.id, session.id);
      else await api.deleteLiveSession(course.id, session.id);
      toast({ type: 'ok', title: action === 'publish' ? t('published', { default: 'Session published' }) : action === 'cancel' ? t('cancelled', { default: 'Session cancelled' }) : t('deleted', { default: 'Session deleted' }) });
      await load();
    } catch (actionError) {
      toast({ type: 'err', title: t('actionFailed', { default: 'Action failed' }), description: actionError instanceof Error ? actionError.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const formatWhen = (session: LiveSession) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: session.timezone || undefined,
      }).format(new Date(session.startsAt));
    } catch {
      return new Date(session.startsAt).toLocaleString();
    }
  };

  return (
    <div className="space-y-6">
      <FormSection
        title={t('section', { default: 'Live sessions' })}
        icon={Video}
        description={t('sectionDesc', { default: 'Schedule live teaching on Google Meet. Published sessions appear on the course page for enrolled learners, who can join 15 minutes before start.' })}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary"
          >
            <Plus className="size-4" />
            {t('add', { default: 'Add live session' })}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            {t('refresh', { default: 'Refresh' })}
          </button>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t('empty', { default: 'No live sessions yet. Add one and paste a Google Meet URL.' })}
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id} className="rounded-xl border border-border bg-background p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{session.title}</p>
                      <StatusPill label={session.status} tone={STATUS_TONE[session.status] ?? 'slate'} dot={false} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5 shrink-0" />
                      {formatWhen(session)}
                      <span className="text-border-strong">·</span>
                      <span dir="ltr">{session.timezone}</span>
                      {session.capacity != null ? (
                        <>
                          <span className="text-border-strong">·</span>
                          {t('capacityN', { count: session.capacity })}
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {session.meetUrl || t('noMeetUrl', { default: 'No Meet link yet — required before publishing' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => openEdit(session)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition hover:bg-muted">
                      <Pencil className="size-3.5" />
                      {t('edit', { default: 'Edit' })}
                    </button>
                    {session.status === 'draft' ? (
                      <button type="button" onClick={() => void act(session, 'publish')} disabled={busyId === session.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-50">
                        {busyId === session.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {t('publish', { default: 'Publish' })}
                      </button>
                    ) : null}
                    {session.status === 'scheduled' || session.status === 'live' ? (
                      <button type="button" onClick={() => void act(session, 'cancel')} disabled={busyId === session.id} className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50">
                        {t('cancel', { default: 'Cancel' })}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void act(session, 'delete')} disabled={busyId === session.id} aria-label={t('delete', { default: 'Delete' })} className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-destructive/5 hover:text-destructive disabled:opacity-50">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {draft ? (
        <FormSection
          title={draft.id ? t('editTitle', { default: 'Edit live session' }) : t('createTitle', { default: 'New live session' })}
          icon={Video}
          description={t('formHint', { default: 'Dates are interpreted in your local timezone and stored in UTC. Times are shown to learners in the session timezone.' })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('titleLabel', { default: 'Title' })}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={t('titlePlaceholder', { default: 'Live Q&A: Week 1' })}
            />
            <TextField
              label={t('meetUrlLabel', { default: 'Google Meet URL' })}
              dir="ltr"
              value={draft.meetUrl}
              onChange={(event) => setDraft({ ...draft, meetUrl: event.target.value })}
              placeholder="https://meet.google.com/abc-defg-hij"
              hint={t('meetUrlHint', { default: 'Only https://meet.google.com links are accepted.' })}
            />
            <TextField
              label={t('startsAtLabel', { default: 'Starts' })}
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
            />
            <TextField
              label={t('endsAtLabel', { default: 'Ends' })}
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
            />
            <Field label={t('timezoneLabel', { default: 'Timezone shown to learners' })}>
              {(field) => (
                <input
                  {...field}
                  dir="ltr"
                  list="live-session-timezones"
                  value={draft.timezone}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </Field>
            <datalist id="live-session-timezones">
              {['UTC', 'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles'].map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <TextField
              label={t('capacityLabel', { default: 'Capacity (optional)' })}
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
            />
            <div className="sm:col-span-2">
              <Field label={t('descriptionLabel', { default: 'Description (optional)' })}>
                {(field) => (
                  <textarea
                    {...field}
                    rows={3}
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </Field>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {draft.id ? t('save', { default: 'Save changes' }) : t('create', { default: 'Create session' })}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="size-4" />
              {t('discard', { default: 'Discard' })}
            </button>
          </div>
        </FormSection>
      ) : null}
    </div>
  );
}
