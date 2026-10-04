'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, ExternalLink, Info, Lock, Rocket, ShieldCheck } from 'lucide-react';
import { type StepState, stepLabel, stepHint } from './completeness';
import type { CourseStudioData } from './types';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { StatusPill, Skeleton } from '@/components/admin/admin-ui';

/**
 * Which certificate template would actually issue for this course.
 *
 * The backend resolves course -> academy -> tenant, and there was previously no
 * way to see that from the Studio: `autoIssueCertificate` had no control at all,
 * and a course with no resolvable template simply produced no certificate.
 */
interface Resolution {
  matchedBy: 'course' | 'academy' | 'tenant' | 'none';
  autoIssueEnabled: boolean;
  template: {
    id: string;
    name: string;
    scopeType: string;
    fieldCount: number;
    willUseDefaultLayout: boolean;
  } | null;
}

export function StepPublish({
  course,
  steps,
  reasons,
  warnings,
  canPublish,
  saving,
  onPublish,
  onRetryCheck,
  onPreviewCourse,
  onToggleAutoIssue,
}: {
  course: CourseStudioData;
  steps: StepState[];
  reasons: string[];
  warnings: string[];
  canPublish: boolean;
  saving: boolean;
  onPublish: () => void;
  onRetryCheck: () => void;
  onPreviewCourse: () => void;
  onToggleAutoIssue: (next: boolean) => void;
}) {
  const t = useTranslations('courses');
  const tCert = useTranslations('courses.studio.certificate');
  const [resolution, setResolution] = useState<Resolution | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/proxy/admin/cert-templates/resolve/course/${encodeURIComponent(course.slug)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setResolution(data as Resolution);
      } catch {
        if (!cancelled) setResolution(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [course.slug, course.autoIssueCertificate]);

  const scopeLabel =
    resolution?.matchedBy === 'course'
      ? tCert('scopeCourse', { default: 'Course template' })
      : resolution?.matchedBy === 'academy'
        ? tCert('scopeAcademy', { default: 'Academy template' })
        : resolution?.matchedBy === 'tenant'
          ? tCert('scopeTenant', { default: 'Tenant default' })
          : tCert('scopeNone', { default: 'No template' });
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('studio.releaseCenter', { default: 'Release center' })}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">{t('studio.readyForLearners', { default: 'Ready for learners?' })}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('studio.releaseHint', { default: 'Review the checklist, resolve blockers, and preview the public course before you publish.' })}</p>
          </div>
          <span className={cn('inline-flex shrink-0 items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold', course.isPublished ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
            {course.isPublished ? <ShieldCheck className="size-4" /> : <Rocket className="size-4" />}
            {course.isPublished ? t('studio.published', { default: 'Published' }) : t('studio.draft', { default: 'Draft' })}
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={!canPublish || saving || course.isPublished} onClick={onPublish} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
            <Rocket className="size-4" />
            {course.isPublished ? t('studio.courseIsLive', { default: 'Course is live' }) : saving ? t('studio.publishing', { default: 'Publishing…' }) : t('studio.publishCourse', { default: 'Publish course' })}
          </button>
          <button type="button" onClick={onPreviewCourse} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:bg-muted">
            <ExternalLink className="size-4" />
            {t('studio.previewCourse', { default: 'Preview course' })}
          </button>
        </div>
      </div>

      {/* Certificate configuration. */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="size-4" />
            </span>
            <div>
              <h3 className="text-13 font-semibold text-foreground">
                {tCert('title', { default: 'Certificate' })}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {tCert('hint', {
                  default: 'Issue a certificate automatically when a learner finishes this course.',
                })}
              </p>
            </div>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2.5 self-start">
            <span className="text-xs font-semibold text-foreground">
              {course.autoIssueCertificate
                ? tCert('on', { default: 'Auto-issue on' })
                : tCert('off', { default: 'Auto-issue off' })}
            </span>
            <Switch
              checked={course.autoIssueCertificate}
              onCheckedChange={onToggleAutoIssue}
              aria-label={tCert('toggle', { default: 'Auto-issue certificate on completion' })}
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">
              {tCert('resolvesTo', { default: 'Resolves to' })}
            </span>
            {resolution ? (
              <>
                <StatusPill
                  label={scopeLabel}
                  tone={
                    resolution.matchedBy === 'none'
                      ? 'rose'
                      : resolution.matchedBy === 'course'
                        ? 'emerald'
                        : resolution.matchedBy === 'academy'
                          ? 'purple'
                          : 'blue'
                  }
                  dot={false}
                />
                {resolution.template && (
                  <span className="truncate font-medium text-foreground">
                    {resolution.template.name}
                  </span>
                )}
              </>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
          </div>
          {resolution?.template?.willUseDefaultLayout && (
            <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {tCert('defaultLayoutWarning', {
                default:
                  'This template has no variables placed, so certificates will use the built-in default layout.',
              })}
            </p>
          )}
          {resolution?.matchedBy === 'none' && (
            <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {tCert('noTemplateWarning', {
                default:
                  'No active template at any scope, so completing this course will not issue a certificate.',
              })}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            {reasons.length ? <Lock className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
            <h3 className="text-sm font-semibold text-foreground">{t('studio.publishBlockers', { default: 'Publish blockers' })}</h3>
          </div>
          {reasons.length ? (
            <ul className="mt-4 space-y-2.5">
              {reasons.map((reason) => <li key={reason} className="flex gap-2 text-sm leading-relaxed text-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive" />{reason}</li>)}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-success/5 px-3 py-3 text-sm text-success">{t('studio.allChecksClear', { default: 'All required checks are clear.' })}</p>
          )}
          {reasons.length > 0 && !canPublish && <button type="button" onClick={onRetryCheck} className="mt-4 text-xs font-semibold underline underline-offset-4">{t('studio.rerunChecks', { default: 'Re-run publish checks' })}</button>}
        </div>
        <div className="rounded-2xl border border-warning/20 bg-warning/5 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">{t('studio.reviewBeforeLaunch', { default: 'Review before launch' })}</h3>
          </div>
          {warnings.length ? (
            <ul className="mt-4 space-y-2.5">
              {warnings.map((warning) => <li key={warning} className="flex gap-2 text-sm leading-relaxed text-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />{warning}</li>)}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-background/60 px-3 py-3 text-sm text-muted-foreground">{t('studio.noOptionalChecks', { default: 'No optional checks need attention.' })}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('studio.studioChecklist', { default: 'Studio checklist' })}</h3>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map((step) => {
            const hint = stepHint(step, t);
            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-start gap-3 rounded-xl border bg-background px-3 py-3',
                  step.done ? 'border-success/25' : step.advisory ? 'border-border' : 'border-destructive/25',
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <span className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {stepLabel(step, t)}
                    {step.advisory && (
                      <span className="ms-1.5 text-2xs font-normal text-muted-foreground">
                        {t('studio.optional', { default: 'optional' })}
                      </span>
                    )}
                  </p>
                  {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
