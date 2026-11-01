'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';
import { Placeholder } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import {
  MapPin,
  Users,
  BookOpen,
  Award,
  MessageSquare,
  Grid,
  Activity,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { getImageSrc } from '@/lib/images';
import { m } from 'framer-motion';
import { AnimatedNumber, Crossfade, Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';
interface ProfileProject {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  url?: string | null;
  projectUrl?: string | null;
}
interface ProfileStats {
  followersCount?: number;
  followingCount?: number;
  coursesCount?: number;
  certificationsCount?: number;
  postsCount?: number;
  followers?: number;
  following?: number;
  enrollments?: number;
  certifications?: number;
  posts?: number;
}
interface ProfileData {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  stats: ProfileStats;
  portfolioItems?: ProfileProject[];
  projects?: ProfileProject[];
}
interface FollowStatus {
  isFollowing: boolean;
  targetUserId: string;
}
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
function CoverImage({ coverUrl }: { coverUrl: string | null }) {
  const tp = useTranslations('pages.publicProfile');
  return (
    <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-56 md:h-72">
      <img src={getImageSrc(coverUrl, 'user')} alt={tp('coverAlt')} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
    </div>
  );
}
function StatsBar({ stats }: { stats: ProfileStats }) {
  const tp = useTranslations('pages.publicProfile');
  const tProfile = useTranslations('profile');
  const items = [
    { label: tProfile('followers'), value: stats.followers ?? stats.followersCount ?? 0, icon: Users },
    { label: tProfile('following'), value: stats.following ?? stats.followingCount ?? 0, icon: Users },
    { label: tp('statCourses'), value: stats.enrollments ?? stats.coursesCount ?? 0, icon: BookOpen },
    {
      label: tp('statCertifications'),
      value: stats.certifications ?? stats.certificationsCount ?? 0,
      icon: Award,
    },
    { label: tProfile('statPosts'), value: stats.posts ?? stats.postsCount ?? 0, icon: MessageSquare },
  ];
  return (
    <Stagger className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 shadow-xs sm:grid-cols-5">
      {items.map((item, index) => (
        <StaggerItem key={item.label} index={index} className="bg-card px-4 py-4">
          <p className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground">
            <AnimatedNumber value={item.value} />
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <item.icon className="size-3.5" />
            {item.label}
          </p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
function ProjectCard({ project }: { project: ProfileProject }) {
  const tp = useTranslations('pages.publicProfile');
  return (
    <Card className="card-hover group h-full overflow-hidden rounded-2xl border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lg">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <img
          src={getImageSrc(project.imageUrl, 'product')}
          alt={project.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <CardContent className="p-5">
        <h3 className="mb-1 truncate font-display text-lg font-medium text-foreground">{project.title}</h3>
        {project.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        )}
        {project.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="soft-muted" className="text-2xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {(project.projectUrl || project.url) && (
          <a
            href={project.projectUrl || project.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-3.5" /> {tp('viewProject')}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
function PortfolioGrid({ projects }: { projects: ProfileProject[] }) {
  const tp = useTranslations('pages.publicProfile');
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Grid className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">{tp('noPortfolioItems')}</p>
      </div>
    );
  }
  return (
    <Stagger className="grid grid-cols-1 gap-6 pb-12 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => (
        <StaggerItem key={project.id} index={index}>
          <ProjectCard project={project} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
function ActivityTabPlaceholder() {
  const tp = useTranslations('pages.publicProfile');
  // `Placeholder` rather than `EmptyState`: nothing failed and nothing is
  // missing — the tab just has no content yet. EmptyState's icon-and-copy
  // pattern over-promises here.
  return (
    <Placeholder
      className="flex-col gap-3 py-16"
      label={tp('activityComingSoon')}
    />
  );
}
function LoadingSkeleton() {
  // Page-specific (hero + overlapping identity block + tab pills), but built
  // from the shared kit so it shimmers and honours prefers-reduced-motion like
  // every other placeholder. The previous version used raw `animate-pulse` on
  // eight divs, which meant this one screen blinked while the rest of the app
  // swept.
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-48 w-full rounded-none sm:h-56 md:h-72" />
      <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-4">
        <div className="mb-6 flex items-end gap-4">
          <SkeletonCircle className="size-28 border-4 border-background" />
          <div className="flex-1 space-y-2 pb-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="mb-6 h-4 w-full max-w-xl" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
      </div>
    </div>
  );
}
export default function ProfilePage() {
  const tp = useTranslations('pages.publicProfile');
  const tProfile = useTranslations('profile');
  const params = useParams();
  const username = params.username as string;
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'activity'>('portfolio');
  const isOwnProfile = !!(user && user.username === username);
  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      try {
        setLoading(true);
        const res = await fetch(`/api/proxy/profile/${username}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [username]);
  useEffect(() => {
    let cancelled = false;
    async function fetchFollowStatus() {
      try {
        const res = await fetch(`/api/proxy/profile/${username}/follow-status`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setFollowStatus(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (username) fetchFollowStatus();
    return () => {
      cancelled = true;
    };
  }, [username]);
  const handleFollowToggle = useCallback(async () => {
    if (!followStatus || followLoading) return;
    try {
      setFollowLoading(true);
      const res = await fetch(`/api/proxy/profile/${followStatus.targetUserId}/follow`, { credentials: 'include', method: 'POST' });
      if (!res.ok) throw new Error(tProfile('followFailed'));
      const wasFollowing = followStatus.isFollowing;
      setFollowStatus((prev) => (prev ? { ...prev, isFollowing: !prev.isFollowing } : null));
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            followers:
              (prev.stats.followers ?? prev.stats.followersCount ?? 0) +
              (followStatus.isFollowing ? -1 : 1),
          },
        };
      });
      toast({ type: 'ok', title: wasFollowing ? tProfile('unfollowed') : tProfile('nowFollowing') });
    } catch (err) {
      toast({
        type: 'err',
        title: tProfile('followFailed'),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setFollowLoading(false);
    }
  }, [followStatus, followLoading, tProfile]);
  if (loading) return <LoadingSkeleton />;
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="mb-2 font-display text-3xl font-medium tracking-[-0.02em] text-foreground">
            {tProfile('notFoundTitle')}
          </h1>
          <p className="text-muted-foreground">{tp('notFoundHint', { username })}</p>
        </div>
      </div>
    );
  }
  const initials = getInitials(profile.name || profile.username);
  const tabs = [
    { id: 'portfolio' as const, label: tProfile('tabPortfolio'), icon: Grid },
    { id: 'activity' as const, label: tProfile('tabActivity'), icon: Activity },
  ];
  return (
    <div className="min-h-screen bg-background">
      <CoverImage coverUrl={profile.coverImageUrl} />
      <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-4">
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="size-28 flex-shrink-0 overflow-hidden rounded-full border-4 border-background bg-card shadow-lg">
            <Avatar className="h-full w-full">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.name} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/10 font-display text-3xl font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl">
              {profile.name}
            </h1>
            {profile.headline && <p className="mt-1 text-muted-foreground">{profile.headline}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">@{profile.username}</span>
              {profile.location && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {profile.location}
                </span>
              )}
            </div>
          </div>
          {!isOwnProfile && (
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              {isAuthenticated && followStatus && (
                <Button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  variant={followStatus.isFollowing ? 'outline' : 'default'}
                  className="rounded-full px-5"
                >
                  {followLoading && <Loader2 className="me-1 size-4 animate-spin" />}
                  {followStatus.isFollowing ? tProfile('following') : tProfile('follow')}
                </Button>
              )}
              <Button variant="outline" className="rounded-full">
                <MessageSquare className="me-1 size-4" /> {tp('message')}
              </Button>
            </div>
          )}
        </div>
        {profile.bio && (
          <p className="mb-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{profile.bio}</p>
        )}
        <StatsBar stats={profile.stats} />
        <div className="mb-8 mt-10 flex gap-1 border-b border-border/70" role="tablist">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <tab.icon className="size-4" /> {tab.label}
                {active && (
                  <m.span
                    layoutId="public-profile-tab"
                    transition={spring.smooth}
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        <Crossfade value={activeTab}>
          {activeTab === 'portfolio' ? (
            <PortfolioGrid projects={profile.portfolioItems ?? []} />
          ) : (
            <ActivityTabPlaceholder />
          )}
        </Crossfade>
      </div>
    </div>
  );
}
