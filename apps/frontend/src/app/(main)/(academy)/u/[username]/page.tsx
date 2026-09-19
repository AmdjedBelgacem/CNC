'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  MapPin,
  Users,
  BookOpen,
  Award,
  MessageSquare,
  Grid,
  Activity,
  Plus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
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
    <div className="relative h-48 sm:h-56 md:h-64 w-full overflow-hidden bg-[#1e2128]">
      {' '}
      {coverUrl ? (
        <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-[#1e2128] via-[#252a33] to-[#1e2128]" />
      )}{' '}
      <div className="absolute inset-0 bg-gradient-to-t from-[#16181c] to-transparent" />{' '}
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
          className="flex items-center gap-2 rounded-lg bg-[#1e2128] px-4 py-2.5"
        >
          {' '}
          <item.icon className="h-4 w-4 text-amber-500" />{' '}
          <span className="text-sm font-semibold text-white">{item.value}</span>{' '}
          <span className="text-xs text-gray-500">{item.label}</span>{' '}
        </div>
      ))}{' '}
    </div>
  );
}
function ProjectCard({ project }: { project: ProfileProject }) {
  return (
    <Card className="overflow-hidden border-gray-700/30 bg-[#1e2128] hover:border-amber-500/30 transition-colors">
      {' '}
      <div className="aspect-video bg-[#252a33] relative overflow-hidden">
        {' '}
        {project.imageUrl ? (
          <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {' '}
            <Plus className="h-8 w-8 text-gray-600" />{' '}
          </div>
        )}{' '}
      </div>{' '}
      <CardContent className="p-4">
        {' '}
        <h3 className="font-semibold text-white text-sm mb-1 truncate"> {project.title} </h3>{' '}
        {project.description && (
          <p className="text-xs text-gray-400 line-clamp-2 mb-3"> {project.description} </p>
        )}{' '}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {' '}
            {project.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-amber-500/20 text-amber-500/80 text-[10px]"
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
            className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400"
          >
            {' '}
            <ExternalLink className="h-3 w-3" /> View project{' '}
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
        <Grid className="mx-auto h-12 w-12 text-gray-600 mb-3" />{' '}
        <p className="text-gray-400 text-sm">No portfolio items yet</p>{' '}
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
  return (
    <div className="text-center py-16">
      {' '}
      <Activity className="mx-auto h-12 w-12 text-gray-600 mb-3" />{' '}
      <p className="text-gray-400 text-sm">Activity feed coming soon</p>{' '}
    </div>
  );
}
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#16181c]">
      {' '}
      <div className="h-48 sm:h-56 md:h-64 bg-[#1e2128] animate-pulse" />{' '}
      <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10">
        {' '}
        <div className="flex items-end gap-4 mb-6">
          {' '}
          <div className="w-24 h-24 rounded-full bg-[#252a33] animate-pulse border-4 border-[#1e2128]" />{' '}
          <div className="flex-1 space-y-2 pb-1">
            {' '}
            <div className="h-6 w-48 bg-[#252a33] rounded animate-pulse" />{' '}
            <div className="h-4 w-32 bg-[#252a33] rounded animate-pulse" />{' '}
          </div>{' '}
        </div>{' '}
        <div className="h-4 w-full max-w-xl bg-[#252a33] rounded animate-pulse mb-6" />{' '}
        <div className="flex gap-2">
          {' '}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-28 bg-[#252a33] rounded-lg animate-pulse" />
          ))}{' '}
        </div>{' '}
      </div>{' '}
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
      <div className="min-h-screen bg-[#16181c] flex items-center justify-center">
        {' '}
        <div className="text-center">
          {' '}
          <h1 className="text-2xl font-bold text-white mb-2">Profile not found</h1>{' '}
          <p className="text-gray-400">The user @{username} does not exist.</p>{' '}
        </div>{' '}
      </div>
    );
  }
  const initials = getInitials(profile.name || profile.username);
  return (
    <div className="min-h-screen bg-[#16181c]">
      {' '}
      <CoverImage coverUrl={profile.coverImageUrl} />{' '}
      <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10">
        {' '}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6">
          {' '}
          <div className="w-24 h-24 rounded-full border-4 border-[#1e2128] overflow-hidden flex-shrink-0 bg-[#1e2128]">
            {' '}
            <Avatar className="w-full h-full">
              {' '}
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.name} className="object-cover" />
              ) : null}{' '}
              <AvatarFallback className="bg-amber-500/10 text-amber-500 text-2xl font-bold">
                {' '}
                {initials}{' '}
              </AvatarFallback>{' '}
            </Avatar>{' '}
          </div>{' '}
          <div className="flex-1 min-w-0">
            {' '}
            <h1 className="text-2xl font-bold text-white truncate"> {profile.name} </h1>{' '}
            {profile.headline && <p className="text-gray-400 mt-0.5">{profile.headline}</p>}{' '}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {' '}
              <span className="text-sm text-gray-500">@{profile.username}</span>{' '}
              {profile.location && (
                <span className="flex items-center gap-1 text-sm text-gray-400">
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
                      ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'
                      : 'bg-amber-500 hover:bg-amber-600 text-black font-medium'
                  }
                >
                  {' '}
                  {followLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{' '}
                  {followStatus.isFollowing ? 'Following' : 'Follow'}{' '}
                </Button>
              )}{' '}
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700/50"
              >
                {' '}
                <MessageSquare className="w-4 h-4 mr-1" /> Message{' '}
              </Button>{' '}
            </div>
          )}{' '}
        </div>{' '}
        {profile.bio && (
          <p className="text-gray-300 max-w-2xl mb-6 leading-relaxed"> {profile.bio} </p>
        )}{' '}
        <StatsBar stats={profile.stats} />{' '}
        <div className="flex border-b border-gray-700/50 mt-8 mb-6">
          {' '}
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'portfolio' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
          >
            {' '}
            <Grid className="w-4 h-4" /> Portfolio{' '}
          </button>{' '}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activity' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
          >
            {' '}
            <Activity className="w-4 h-4" /> Activity{' '}
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
