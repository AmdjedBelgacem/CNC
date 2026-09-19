'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { PostCard, type PostData } from '@/components/feed/post-card';
import { CreatePostModal } from '@/components/feed/create-post-modal';
import { CommentsDrawer } from '@/components/feed/comments-drawer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { io, Socket } from 'socket.io-client';
import { Loader2 } from 'lucide-react';
const API = '/api/proxy/feed';
export default function FeedPage() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchPosts = useCallback(async (pageNum: number, append = false) => {
    if (!append) setLoading(true);
    try {
      const res = await fetch(`${API}?page=${pageNum}&limit=10`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (append) {
        setPosts((prev) => [...prev, ...(data.data || [])]);
      } else {
        setPosts(data.data || []);
      }
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch {
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      path: '/ws',
      query: { userId: user.id },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('new-post', () => fetchPosts(1));
    socket.on('new-like', () => fetchPosts(1));
    return () => {
      socket.close();
    };
  }, [user?.id, fetchPosts]);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]!.isIntersecting && !loadingMore && posts.length < total) {
          setLoadingMore(true);
          fetchPosts(page + 1, true);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchPosts, page, total, loadingMore, posts.length]);
  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`${API}/${postId}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: data.liked, likeCount: p.likeCount + (data.liked ? 1 : -1) }
            : p,
        ),
      );
    } catch {}
  };
  const handleDelete = async (postId: string) => {
    try {
      await fetch(`${API}/${postId}`, { method: 'DELETE', credentials: 'include' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {' '}
      <div className="mb-6">
        {' '}
        <h1 className="text-3xl font-bold">Community Feed</h1>{' '}
        <p className="text-muted-foreground mt-1">Connect with machinists worldwide.</p>{' '}
      </div>{' '}
      <div
        className="flex items-center gap-3 rounded-xl border bg-card p-4 mb-6 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setShowCreate(true)}
      >
        {' '}
        <Avatar className="h-10 w-10">
          {' '}
          <AvatarImage
            src={
              user?.name
                ? `https://ui-avatars.com/api/?name=${user.name}&background=random`
                : undefined
            }
          />{' '}
          <AvatarFallback>{(user?.name || 'You')[0]}</AvatarFallback>{' '}
        </Avatar>{' '}
        <span className="flex-1 text-sm text-muted-foreground">
          Share something with the community...
        </span>{' '}
        <Button size="sm">Post</Button>{' '}
      </div>{' '}
      {loading ? (
        <div className="space-y-4">
          {' '}
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              {' '}
              <div className="flex items-center gap-3">
                {' '}
                <Skeleton className="h-10 w-10 rounded-full" />{' '}
                <div className="space-y-1">
                  {' '}
                  <Skeleton className="h-4 w-24" /> <Skeleton className="h-3 w-16" />{' '}
                </div>{' '}
              </div>{' '}
              <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-3/4" />{' '}
            </div>
          ))}{' '}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          {' '}
          <p className="text-lg mb-2">No posts yet</p>{' '}
          <p className="text-sm">Be the first to share something!</p>{' '}
        </div>
      ) : (
        <div className="space-y-4">
          {' '}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onLike={handleLike}
              onDelete={handleDelete}
              onCommentClick={setCommentPost}
            />
          ))}{' '}
        </div>
      )}{' '}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center">
        {' '}
        {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}{' '}
      </div>{' '}
      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchPosts(1)}
      />{' '}
      {commentPost && (
        <CommentsDrawer
          postId={commentPost.id}
          postContent={commentPost.content}
          open={!!commentPost}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => fetchPosts(1)}
        />
      )}{' '}
    </div>
  );
}
