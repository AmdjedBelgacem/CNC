'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, MessageCircle, Heart } from 'lucide-react';
interface FeedPost {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  mediaUrls?: string[];
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
}
export function CommunityFeedPreview() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/proxy/feed?limit=3', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => setPosts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (!loading && posts.length === 0) return null;
  return (
    <section className="border-t py-24">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        <div className="flex items-center justify-between mb-12">
          {' '}
          <div>
            {' '}
            <h2 className="text-3xl font-bold">From the Community</h2>{' '}
            <p className="text-muted-foreground mt-1">
              What machinists are sharing right now.
            </p>{' '}
          </div>{' '}
          <Button variant="ghost" asChild>
            {' '}
            <Link href="/feed">
              View Feed <ArrowRight className="flip-rtl ms-2 size-4" />
            </Link>{' '}
          </Button>{' '}
        </div>{' '}
        <div className="grid gap-6 md:grid-cols-3">
          {' '}
          {loading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                  {' '}
                  <div className="flex items-center gap-3">
                    {' '}
                    <Skeleton className="size-8 rounded-full" />{' '}
                    <Skeleton className="h-4 w-24" />{' '}
                  </div>{' '}
                  <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-3/4" />{' '}
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>{' '}
                </div>
              ))
            : posts.map((post) => (
                <Link
                  key={post.id}
                  href="/feed"
                  className="rounded-xl border bg-card p-5 space-y-3 hover:border-primary/50 transition-colors group"
                >
                  {' '}
                  <div className="flex items-center gap-3">
                    {' '}
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {' '}
                      {(post.user.name || '?')[0]}{' '}
                    </div>{' '}
                    <div>
                      {' '}
                      <p className="text-sm font-medium">{post.user.name || 'Unknown'}</p>{' '}
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(post.createdAt)}
                      </p>{' '}
                    </div>{' '}
                  </div>{' '}
                  <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>{' '}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {' '}
                    <span className="flex items-center gap-1">
                      <Heart className="size-3.5" /> {post.likeCount}
                    </span>{' '}
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3.5" /> {post.commentCount}
                    </span>{' '}
                  </div>{' '}
                </Link>
              ))}{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
function timeAgo(date: string) {
  const sec = (Date.now() - new Date(date).getTime()) / 1000;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
