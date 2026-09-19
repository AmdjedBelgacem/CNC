'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PostCard, type PostData } from '@/components/feed/post-card';
import { useAuthStore } from '@/stores/auth-store';
import { MapPin, UserPlus, UserMinus, Calendar } from 'lucide-react';
import { MessageButton } from '@/components/dm/message-button';
interface ProfileData {
  id: string;
  name: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  role: string;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  portfolioItems: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    tags: string[] | null;
  }[];
}
export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    fetch(`/api/proxy/social/profile/${userId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  useEffect(() => {
    fetch(`/api/proxy/feed?limit=20`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPosts((data.data || []).filter((p: PostData) => p.user.id === userId)))
      .catch(() => {});
  }, [userId]);
  const handleFollow = async () => {
    const method = profile?.isFollowing ? 'DELETE' : 'POST';
    await fetch(`/api/proxy/social/follow/${userId}`, { credentials: 'include', method });
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: !prev.isFollowing,
            followerCount: prev.followerCount + (prev.isFollowing ? -1 : 1),
          }
        : null,
    );
  };
  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        {' '}
        <Skeleton className="h-48 rounded-xl mb-6" />{' '}
        <div className="space-y-3">
          {' '}
          <Skeleton className="h-8 w-48" /> <Skeleton className="h-4 w-32" />{' '}
          <Skeleton className="h-20 w-full" />{' '}
        </div>{' '}
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
        User not found.
      </div>
    );
  }
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {' '}
      <div className="rounded-xl border bg-card overflow-hidden">
        {' '}
        <div className="h-32 bg-gradient-to-r from-primary/20 to-secondary/30" />{' '}
        <div className="px-6 pb-6 -mt-12">
          {' '}
          <Avatar className="h-24 w-24 border-4 border-background">
            {' '}
            <AvatarImage src={profile.avatarUrl || undefined} />{' '}
            <AvatarFallback className="text-2xl">{(profile.name || '?')[0]}</AvatarFallback>{' '}
          </Avatar>{' '}
          <div className="flex items-start justify-between mt-3">
            {' '}
            <div>
              {' '}
              <h1 className="text-2xl font-bold">{profile.name || 'Unknown'}</h1>{' '}
              {profile.headline && <p className="text-muted-foreground">{profile.headline}</p>}{' '}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {' '}
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.location}
                  </span>
                )}{' '}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </span>{' '}
              </div>{' '}
            </div>{' '}
            {user?.id !== userId && (
              <div className="flex items-center gap-2">
                {' '}
                <MessageButton peerId={userId} peerName={profile.name} />{' '}
                <Button
                  variant={profile.isFollowing ? 'outline' : 'default'}
                  size="sm"
                  onClick={handleFollow}
                >
                  {' '}
                  {profile.isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-1" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1" /> Follow
                    </>
                  )}{' '}
                </Button>{' '}
              </div>
            )}{' '}
          </div>{' '}
          <div className="flex items-center gap-6 mt-4 text-sm">
            {' '}
            <span>
              <strong className="text-foreground">{profile.postCount}</strong>{' '}
              <span className="text-muted-foreground">posts</span>
            </span>{' '}
            <span>
              <strong className="text-foreground">{profile.followerCount}</strong>{' '}
              <span className="text-muted-foreground">followers</span>
            </span>{' '}
            <span>
              <strong className="text-foreground">{profile.followingCount}</strong>{' '}
              <span className="text-muted-foreground">following</span>
            </span>{' '}
          </div>{' '}
          {profile.bio && (
            <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>
          )}{' '}
        </div>{' '}
      </div>{' '}
      {profile.portfolioItems.length > 0 && (
        <section className="mt-8">
          {' '}
          <h2 className="text-xl font-bold mb-4">Portfolio</h2>{' '}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {' '}
            {profile.portfolioItems.map((item) => (
              <div key={item.id} className="rounded-lg border bg-card p-4 space-y-2">
                {' '}
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full aspect-video rounded-md object-cover"
                  />
                )}{' '}
                <h3 className="font-semibold text-sm">{item.title}</h3>{' '}
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}{' '}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {' '}
                    {item.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1.5">
                        {t}
                      </Badge>
                    ))}{' '}
                  </div>
                )}{' '}
              </div>
            ))}{' '}
          </div>{' '}
        </section>
      )}{' '}
      <section className="mt-8">
        {' '}
        <h2 className="text-xl font-bold mb-4">Posts</h2>{' '}
        <div className="space-y-4">
          {' '}
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                onLike={() => {}}
                onCommentClick={() => {}}
              />
            ))
          )}{' '}
        </div>{' '}
      </section>{' '}
    </div>
  );
}
