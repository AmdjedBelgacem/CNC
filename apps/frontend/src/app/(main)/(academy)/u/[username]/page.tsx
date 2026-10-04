'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';
import { Placeholder } from '@/components/ui/states';
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
  return (
    <div className="relative h-48 sm:h-56 md:h-64 w-full overflow-hidden bg-card">
      <img src={getImageSrc(coverUrl, 'user')} alt="Cover" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
function StatsBar({ stats }: { stats: ProfileStats }) {
  const items = [
    { label: 'Followers', value: stats.followers ?? stats.followersCount ?? 0, icon: Users },
    { label: 'Following', value: stats.following ?? stats.followingCount ?? 0, icon: Users },
    { label: 'Courses', value: stats.enrollments ?? stats.coursesCount ?? 0, icon: BookOpen },
    {
      label: 'Certifications',
      value: stats.certifications ?? stats.certificationsCount ?? 0,
      icon: Award,
    },
    { label: 'Posts', value: stats.posts ?? stats.postsCount ?? 0, icon: MessageSquare },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {' '}
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5"
        >
          {' '}
          <item.icon className="size-4 text-warning" />{' '}
          <span className="text-sm font-semibold text-white">{item.value}</span>{' '}
          <span className="text-xs text-muted-foreground">{item.label}</span>{' '}
        </div>
      ))}{' '}
    </div>
  );
}
function ProjectCard({ project }: { project: ProfileProject }) {
  return (
    <Card className="overflow-hidden border-border bg-card hover:border-warning/40 transition-colors">
      {' '}
      <div className="aspect-video bg-muted relative overflow-hidden">
        <img src={getImageSrc(project.imageUrl, 'product')} alt={project.title} className="w-full h-full object-cover" />
      </div>{' '}
      <CardContent className="p-4">
        {' '}
        <h3 className="font-semibold text-white text-sm mb-1 truncate"> {project.title} </h3>{' '}
        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3"> {project.description} </p>
        )}{' '}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {' '}
            {project.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-warning/25 text-warning/80 text-2xs"
              >
                {' '}
                {tag}{' '}
              </Badge>
            ))}{' '}
          </div>
        )}{' '}
        {(project.projectUrl || project.url) && (
          <a
            href={project.projectUrl || project.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-warning hover:text-warning"
          >
            {' '}
            <ExternalLink className="size-3.5" /> View project{' '}
          </a>
        )}{' '}
      </CardContent>{' '}
    </Card>
  );
}
function PortfolioGrid({ projects }: { projects: ProfileProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        {' '}
        <Grid className="mx-auto h-12 w-12 text-muted-foreground mb-3" />{' '}
        <p className="text-muted-foreground text-sm">No portfolio items yet</p>{' '}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
      {' '}
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}{' '}
    </div>
  );
}
function ActivityTabPlaceholder() {
  // `Placeholder` rather than `EmptyState`: nothing failed and nothing is
  // missing — the tab just has no content yet. EmptyState's icon-and-copy
  // pattern over-promises here.
  return (
    <Placeholder
      className="flex-col gap-3 py-16"
      label="Activity feed coming soon"
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
      <Skeleton className="h-48 w-full rounded-none sm:h-56 md:h-64" />
      <div className="relative z-10 mx-auto -mt-12 max-w-5xl px-4">
        <div className="mb-6 flex items-end gap-4">
          <SkeletonCircle className="size-24 border-4 border-card" />
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
      await fetch(`/api/proxy/profile/${followStatus.targetUserId}/follow`, { credentials: 'include', method: 'POST' });
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
    } catch (err) {
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  }, [followStatus, followLoading]);
  if (loading) return <LoadingSkeleton />;
  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {' '}
        <div className="text-center">
          {' '}
          <h1 className="text-2xl font-bold text-white mb-2">Profile not found</h1>{' '}
          <p className="text-muted-foreground">The user @{username} does not exist.</p>{' '}
        </div>{' '}
      </div>
    );
  }
  const initials = getInitials(profile.name || profile.username);
  return (
    <div className="min-h-screen bg-background">
      {' '}
      <CoverImage coverUrl={profile.coverImageUrl} />{' '}
      <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10">
        {' '}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6">
          {' '}
          <div className="w-24 h-24 rounded-full border-4 border-card overflow-hidden flex-shrink-0 bg-card">
            {' '}
            <Avatar className="w-full h-full">
              {' '}
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.name} className="object-cover" />
              ) : null}{' '}
              <AvatarFallback className="bg-warning/10 text-warning text-2xl font-bold">
                {' '}
                {initials}{' '}
              </AvatarFallback>{' '}
            </Avatar>{' '}
          </div>{' '}
          <div className="flex-1 min-w-0">
            {' '}
            <h1 className="text-2xl font-bold text-white truncate"> {profile.name} </h1>{' '}
            {profile.headline && <p className="text-muted-foreground mt-0.5">{profile.headline}</p>}{' '}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {' '}
              <span className="text-sm text-muted-foreground">@{profile.username}</span>{' '}
              {profile.location && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {' '}
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}{' '}
                </span>
              )}{' '}
            </div>{' '}
          </div>{' '}
          {!isOwnProfile && (
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              {' '}
              {isAuthenticated && followStatus && (
                <Button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  variant={followStatus.isFollowing ? 'outline' : 'default'}
                  className={
                    followStatus.isFollowing
                      ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : 'bg-warning hover:bg-warning text-black font-medium'
                  }
                >
                  {' '}
                  {followLoading && <Loader2 className="size-4 animate-spin me-1" />}{' '}
                  {followStatus.isFollowing ? 'Following' : 'Follow'}{' '}
                </Button>
              )}{' '}
              <Button
                variant="outline"
                className="border-border-strong text-muted-foreground hover:bg-muted"
              >
                {' '}
                <MessageSquare className="size-4 me-1" /> Message{' '}
              </Button>{' '}
            </div>
          )}{' '}
        </div>{' '}
        {profile.bio && (
          <p className="text-muted-foreground max-w-2xl mb-6 leading-relaxed"> {profile.bio} </p>
        )}{' '}
        <StatsBar stats={profile.stats} />{' '}
        <div className="flex border-b border-border mt-8 mb-6">
          {' '}
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'portfolio' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-muted-foreground'}`}
          >
            {' '}
            <Grid className="size-4" /> Portfolio{' '}
          </button>{' '}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-muted-foreground'}`}
          >
            {' '}
            <Activity className="size-4" /> Activity{' '}
          </button>{' '}
        </div>{' '}
        {activeTab === 'portfolio' ? (
          <PortfolioGrid projects={profile.portfolioItems ?? []} />
        ) : (
          <ActivityTabPlaceholder />
        )}{' '}
      </div>{' '}
    </div>
  );
}
