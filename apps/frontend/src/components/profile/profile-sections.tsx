'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Award, BookOpen, CheckCircle2, FileText, MessageSquare, PlayCircle, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/states';
import { ProfileStat } from '@/components/profile/profile-hero';
import { formatDate, formatNumber } from '@/lib/format';
import { getImageSrc } from '@/lib/images';
import type { Profile, ProfileCertificate, ProfileCourse } from '@/lib/api/types';
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

export function ProfileOverview({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const { learning, stats } = profile;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl font-medium tracking-[-0.018em] text-foreground">
          {t('trackRecord')}
        </h2>
        <Stagger className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: BookOpen, label: t('statEnrolled'), value: learning.enrollments },
            { icon: CheckCircle2, label: t('statCompleted'), value: learning.completed, tone: 'accent' as const },
            { icon: Award, label: t('statCertificates'), value: learning.certificates },
            {
              icon: PlayCircle,
              label: t('statHours'),
              value: learning.watchTimeSeconds > 0 ? (learning.watchTimeSeconds / 3600).toFixed(1) : '0',
            },
            { icon: FileText, label: t('statLessons'), value: learning.lessonsCompleted, tone: 'muted' as const },
            { icon: ThumbsUp, label: t('statLikes'), value: stats.likes, tone: 'muted' as const },
            { icon: MessageSquare, label: t('statComments'), value: stats.comments, tone: 'muted' as const },
            { icon: FileText, label: t('statPosts'), value: stats.posts, tone: 'muted' as const },
          ].map((stat, i) => (
            <StaggerItem key={stat.label} index={i}>
              <ProfileStat icon={stat.icon} label={stat.label} value={stat.value} tone={stat.tone} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {(profile.bio || profile.headline) && (
        <Reveal as="section">
          <p className="eyebrow">{t('about')}</p>
          {profile.headline && (
            <p className="mt-3 text-balance font-display text-2xl font-medium leading-snug tracking-[-0.018em] text-foreground">
              {profile.headline}
            </p>
          )}
          {profile.bio && (
            <p className="mt-4 max-w-prose whitespace-pre-line text-base leading-8 text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </Reveal>
      )}

      {profile.skills.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('skillsAndFocus')}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <Badge key={skill} variant="soft">
                {skill}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {profile.portfolioItems.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
              {t('portfolio')}
            </h2>
            <Button variant="link" size="sm" asChild>
              <Link href="#portfolio">{t('viewAll')}</Link>
            </Button>
          </div>
          <Stagger inViewOnly className="mt-4 grid gap-4 sm:grid-cols-2">
            {profile.portfolioItems.slice(0, 4).map((item, i) => (
              <StaggerItem key={item.id} index={i}>
              <Card className="h-full overflow-hidden rounded-xl border-border/70 shadow-xs">
                {item.imageUrl && (
                  <div className="aspect-video overflow-hidden border-b border-border/60 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageSrc(item.imageUrl, 'portfolio')}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-display text-lg font-medium tracking-[-0.01em] text-foreground">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {profile.isPrivate && (
        <Card className="border-dashed p-6">
          <EmptyState
            compact
            icon={CheckCircle2}
            title={t('privateTitle')}
            description={t('privateDescription')}
          />
        </Card>
      )}
    </div>
  );
}

export function ProfileCourseCard({ enrollment }: { enrollment: ProfileCourse }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const course = enrollment.course;
  if (!course) return null;

  const completed = enrollment.progressPercent >= 100 || enrollment.status === 'completed';
  const started = !completed && enrollment.progressPercent > 0;
  const href = `/courses/${course.slug}`;
  const hours = enrollment.watchTimeSeconds > 0
    ? t('watchTime', { hours: (enrollment.watchTimeSeconds / 3600).toFixed(1) })
    : null;

  return (
    <HoverLift className="h-full">
    <Card className="group flex h-full flex-col overflow-hidden rounded-xl border-border/70 shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg motion-reduce:transition-none">
      {/* Media header: the cover carries the status so the eye finds it first. */}
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden border-b border-border/60 bg-muted">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageSrc(course.thumbnailUrl, 'course')}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-accent/10 text-xs font-medium text-muted-foreground">
            {t('noCover')}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/5 to-transparent" />

        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            {completed ? (
              <Badge variant="success" className="bg-success text-success-foreground">
                {t('completed')}
              </Badge>
            ) : started ? (
              <Badge className="bg-background/95 text-foreground">{t('inProgress')}</Badge>
            ) : (
              <Badge className="bg-background/95 text-foreground">{t('notStarted')}
              </Badge>
            )}
            {enrollment.certificateId && (
              <Badge variant="accent" className="bg-accent text-accent-foreground">
                {t('certified')}
              </Badge>
            )}
          </span>
          {completed && (
            <span className="text-xs font-medium text-background/90">
              {t('certifiedOn', { date: formatDate(enrollment.completedAt ?? enrollment.startedAt, locale) })}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {course.difficulty ? <span>{t('difficulty', { level: course.difficulty })}</span> : null}
          {course.estimatedHours ? <span>{t('hours', { count: course.estimatedHours })}</span> : null}
          {enrollment.totalLessons > 0 && (
            <span>
              {t('lessonsProgress', {
                done: formatNumber(enrollment.completedLessons, locale),
                total: formatNumber(enrollment.totalLessons, locale),
              })}
            </span>
          )}
        </div>

        <h3 className="mt-2 font-display text-lg font-medium leading-snug tracking-[-0.01em] text-foreground">
          <Link href={href} className="transition-colors hover:text-primary">
            {course.title}
          </Link>
        </h3>
        {course.subtitle && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {course.subtitle}
          </p>
        )}

        {/* Progress lives at the foot of the card so the eye reads
            identity -> story -> progress. */}
        <div className="mt-auto pt-4">
          {completed ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="font-medium">{t('finishedCourse')}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{t('progress')}</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {enrollment.progressPercent}%
                </span>
              </div>
              <Progress value={enrollment.progressPercent} className="mt-2" />
            </>
          )}

          {hours && (
            <p className="mt-3 text-xs text-muted-foreground">
              <bdi>{hours}</bdi>
            </p>
          )}
        </div>
      </div>
    </Card>
    </HoverLift>
  );
}

export function ProfileLearning({
  enrollments,
  certificates,
  loading,
  error,
  onRetry,
}: {
  enrollments: ProfileCourse[];
  certificates: ProfileCertificate[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('profile');
  const locale = useLocale();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} media={false} lines={2} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <EmptyState
          compact
          icon={BookOpen}
          title={t('loadFailed')}
          action={
            onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                {t('retry')}
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  if (enrollments.length === 0 && certificates.length === 0) {
    return (
      <Card className="border-dashed p-6">
        <EmptyState
          compact
          icon={BookOpen}
          title={t('noLearning')}
          description={t('noLearningHint')}
        />
      </Card>
    );
  }

  const active = enrollments.filter((e) => e.progressPercent < 100 && e.status !== 'completed');
  const finished = enrollments.filter((e) => e.progressPercent >= 100 || e.status === 'completed');

  return (
    <div className="space-y-12">
      {active.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('inProgressCourses')}
          </h2>
          <Stagger className="mt-4 grid gap-4 sm:grid-cols-2">
            {active.map((enrollment, i) => (
              <StaggerItem key={enrollment.id} index={i}>
                <ProfileCourseCard enrollment={enrollment} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('completedCourses')}
          </h2>
          <Stagger className="mt-4 grid gap-4 sm:grid-cols-2">
            {finished.map((enrollment, i) => (
              <StaggerItem key={enrollment.id} index={i}>
                <ProfileCourseCard enrollment={enrollment} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {certificates.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('certificates')}
          </h2>
          <Stagger inViewOnly className="mt-4 grid gap-4 sm:grid-cols-2">
            {certificates.map((certificate, i) => (
              <StaggerItem key={certificate.id} index={i}>
              <Card className="h-full rounded-xl border-border/70 p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Award className="size-5" />
                  </span>
                  {certificate.revokedAt ? (
                    <Badge variant="destructive">{t('revoked')}</Badge>
                  ) : (
                    <Badge variant="success">{t('valid')}</Badge>
                  )}
                </div>
                <h3 className="mt-4 font-display text-lg font-medium leading-snug tracking-[-0.01em] text-foreground">
                  {certificate.course?.title ?? t('certificate')}
                </h3>
                <p className="mt-1 font-mono text-2xs text-muted-foreground">
                  {certificate.certificateNumber}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span>
                    <bdi>{t('issuedOn', { date: formatDate(certificate.issuedAt, locale) })}</bdi>
                  </span>
                  {certificate.expiresAt && (
                    <span>
                      <bdi>{t('expiresOn', { date: formatDate(certificate.expiresAt, locale) })}</bdi>
                    </span>
                  )}
                  <Button variant="link" size="xs" asChild>
                    <Link href={`/verify/${certificate.certificateNumber}`}>
                      {t('verify')}
                    </Link>
                  </Button>
                </div>
              </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

export function ProfilePortfolio({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const items = profile.portfolioEnabled ? profile.portfolioItems : [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <p className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">{t('noPortfolio')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('noPortfolioHint')}</p>
      </div>
    );
  }

  return (
    <Stagger id="portfolio" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, i) => {
        const Wrapper = item.projectUrl ? 'a' : 'div';
        return (
          <StaggerItem key={item.id} index={i}>
          <HoverLift className="h-full">
          <Wrapper
            {...(item.projectUrl
              ? { href: item.projectUrl, target: '_blank', rel: 'noreferrer noopener' }
              : {})}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg motion-reduce:transition-none"
          >
            {item.imageUrl && (
              <div className="aspect-video overflow-hidden border-b border-border/60 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(item.imageUrl, 'portfolio')}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-medium leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="soft">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Wrapper>
          </HoverLift>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
