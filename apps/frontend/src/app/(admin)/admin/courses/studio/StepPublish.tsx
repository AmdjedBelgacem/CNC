'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, Eye, Lock, Rocket } from 'lucide-react';
import type { CourseStudioData } from './types';
import { Switch } from '@/components/ui/switch';
import { StatusPill, Skeleton } from '@/components/admin/admin-ui';
import { EditorSection } from '@/components/admin/editor/editor-kit';
import { StatusChip } from '@/components/admin/form-page';

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

/**
 * Certificate settings and the release summary.
 *
 * Publishing itself happens in the review sheet (header "Review and publish"),
 * which shows the same checks before it offers the action; this section keeps
 * the server's blockers and the optional advice visible while editing.
 */
export function StepPublish({
  course,
  reasons,
  warnings,
  canPublish,
  checking,
  onReview,
  onRetryCheck,
  onPreviewCourse,
  onToggleAutoIssue,
}: {
  course: CourseStudioData;
  reasons: string[];
  warnings: string[];
  canPublish: boolean;
  checking: boolean;
  onReview: () => void;
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
    <>
      <EditorSection
        id="certificate"
        title={
          <span className="flex items-center gap-2">
            <Award className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
            {tCert('title', { default: 'Certificate' })}
          </span>
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-13 leading-relaxed text-muted-foreground">
            {tCert('hint', { default: 'Issue a certificate automatically when a learner finishes this course.' })}
          </p>
          <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2.5 self-start">
            <span className="text-13 font-medium text-foreground">
              {course.autoIssueCertificate ? tCert('on', { default: 'Auto-issue on' }) : tCert('off', { default: 'Auto-issue off' })}
            </span>
            <Switch
              checked={course.autoIssueCertificate}
              onCheckedChange={onToggleAutoIssue}
              aria-label={tCert('toggle', { default: 'Auto-issue certificate on completion' })}
            />
          </label>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{tCert('resolvesTo', { default: 'Resolves to' })}</span>
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
                  <span className="min-w-0 truncate font-medium text-foreground">{resolution.template.name}</span>
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
                default: 'This template has no variables placed, so certificates will use the built-in default layout.',
              })}
            </p>
          )}
          {resolution?.matchedBy === 'none' && (
            <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {tCert('noTemplateWarning', {
                default: 'No active template at any scope, so completing this course will not issue a certificate.',
              })}
            </p>
          )}
        </div>
      </EditorSection>

      <EditorSection
        id="release"
        title={t('studio.releaseCenter', { default: 'Release center' })}
        actions={
          <StatusChip tone={course.isPublished ? 'live' : 'draft'}>
            {course.isPublished ? t('studio.published', { default: 'Published' }) : t('studio.draft', { default: 'Draft' })}
          </StatusChip>
        }
      >
        <p className="-mt-3 max-w-xl text-13 leading-relaxed text-muted-foreground">
          {t('studio.releaseHint', {
            default: 'Review the checklist, resolve blockers, and preview the public course before you publish.',
          })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onReview}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
          >
            <Rocket className="size-4" />
            {course.isPublished ? t('studio.courseIsLive', { default: 'Course is live' }) : t('studio.publishCourse', { default: 'Publish course' })}
          </button>
          <button
            type="button"
            onClick={onPreviewCourse}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-card px-5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Eye className="size-4" />
            {t('studio.previewCourse', { default: 'Preview course' })}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="flex items-center gap-2">
              {reasons.length ? <Lock className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
              <h3 className="text-sm font-semibold text-foreground">{t('studio.publishBlockers', { default: 'Publish blockers' })}</h3>
            </div>
            {reasons.length ? (
              <ul className="mt-3 space-y-2">
                {reasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-13 leading-relaxed text-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive" />
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-13 text-success">{t('studio.allChecksClear', { default: 'All required checks are clear.' })}</p>
            )}
            {reasons.length > 0 && !canPublish && (
              <button
                type="button"
                onClick={onRetryCheck}
                disabled={checking}
                className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
              >
                {t('studio.rerunChecks', { default: 'Re-run publish checks' })}
              </button>
            )}
          </div>
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">{t('studio.reviewBeforeLaunch', { default: 'Review before launch' })}</h3>
            </div>
            {warnings.length ? (
              <ul className="mt-3 space-y-2">
                {warnings.map((warning) => (
                  <li key={warning} className="flex gap-2 text-13 leading-relaxed text-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-13 text-muted-foreground">{t('studio.noOptionalChecks', { default: 'No optional checks need attention.' })}</p>
            )}
          </div>
        </div>
      </EditorSection>
    </>
  );
}
