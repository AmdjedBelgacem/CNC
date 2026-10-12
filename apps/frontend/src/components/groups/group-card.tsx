'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudyGroup } from '@/lib/groups-api';

/**
 * A study group as shown in the list, the map sidebar and "My groups".
 *
 * The whole card is one `<Link>` rather than a heading link plus separate action buttons: nested
 * interactive elements inside an anchor are invalid and make keyboard order unpredictable. The
 * join/leave controls therefore live on the detail page, not here.
 */
export function GroupCard({ group, className }: { group: StudyGroup; className?: string }) {
  const t = useTranslations('pages.groups');
  const location = [group.city, group.state].filter(Boolean).join(', ');
  const full = group.maxMembers != null && group.memberCount >= group.maxMembers;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all',
        'hover:border-primary/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary/40',
        !group.isActive && 'opacity-70',
        className,
      )}
    >
      {/* Cover. A gradient stands in when there is no image, so the card never opens with a
          broken-image icon; `coverUrl` is optional in the schema. */}
      <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent">
        {group.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.coverUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        {group.academy && (
          <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            {group.academy}
          </span>
        )}
        {!group.isActive && (
          <span className="absolute end-3 top-3 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
            {t('archived')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug">
          {/* The title spans the card; the anchor overlay below is the single click target. */}
          <Link
            href={`/groups/${group.id}`}
            className="stretched-link after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {group.name}
          </Link>
        </h3>

        {group.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{group.description}</p>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <dd>{location}</dd>
            </div>
          )}
          {group.meetingSchedule && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              <dd className="truncate">{group.meetingSchedule}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            <span aria-live="polite">
              {t('memberCount', { count: group.memberCount, max: group.maxMembers ?? 0 })}
            </span>
          </span>
          {full && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('full')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
