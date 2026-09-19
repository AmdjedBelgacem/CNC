'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
export interface PostData {
  id: string;
  content: string;
  mediaUrls?: string[];
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null; headline?: string | null };
  comments?: {
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string | null; avatarUrl: string | null };
  }[];
}
interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onLike: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onCommentClick: (post: PostData) => void;
}
export function PostCard({ post, currentUserId, onLike, onDelete, onCommentClick }: PostCardProps) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const media = post.mediaUrls || [];
  const timeAgo = getTimeAgo(post.createdAt);
  return (
    <Card className="overflow-hidden">
      {' '}
      <CardHeader className="flex-row items-start gap-3 space-y-0 p-4">
        {' '}
        <Link href={`/profile/${post.user.id}`}>
          {' '}
          <Avatar>
            {' '}
            <AvatarImage src={post.user.avatarUrl || undefined} />{' '}
            <AvatarFallback>{(post.user.name || '?')[0]}</AvatarFallback>{' '}
          </Avatar>{' '}
        </Link>{' '}
        <div className="flex-1 min-w-0">
          {' '}
          <div className="flex items-center justify-between">
            {' '}
            <div>
              {' '}
              <Link
                href={`/profile/${post.user.id}`}
                className="text-sm font-semibold hover:underline"
              >
                {' '}
                {post.user.name || 'Unknown'}{' '}
              </Link>{' '}
              {post.user.headline && (
                <p className="text-xs text-muted-foreground">{post.user.headline}</p>
              )}{' '}
            </div>{' '}
            <div className="flex items-center gap-2">
              {' '}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>{' '}
              {currentUserId === post.user.id && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(post.id)}
                >
                  {' '}
                  <Trash2 className="h-3.5 w-3.5" />{' '}
                </Button>
              )}{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
      </CardHeader>{' '}
      <CardContent className="px-4 pb-3">
        {' '}
        <p className="text-sm whitespace-pre-line mb-3">{post.content}</p>{' '}
        {media.length > 0 && (
          <div className="relative rounded-lg overflow-hidden bg-muted mb-3">
            {' '}
            <img src={media[mediaIdx]} alt="" className="w-full max-h-96 object-cover" />{' '}
            {media.length > 1 && (
              <>
                {' '}
                <button
                  onClick={() => setMediaIdx((i) => (i - 1 + media.length) % media.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 hover:bg-background"
                >
                  {' '}
                  <ChevronLeft className="h-4 w-4" />{' '}
                </button>{' '}
                <button
                  onClick={() => setMediaIdx((i) => (i + 1) % media.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 hover:bg-background"
                >
                  {' '}
                  <ChevronRight className="h-4 w-4" />{' '}
                </button>{' '}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {' '}
                  {media.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${i === mediaIdx ? 'bg-white' : 'bg-white'}`}
                    />
                  ))}{' '}
                </div>{' '}
              </>
            )}{' '}
          </div>
        )}{' '}
        <div className="flex items-center gap-4">
          {' '}
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${post.likedByMe ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
          >
            {' '}
            <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} />{' '}
            {post.likeCount > 0 && post.likeCount}{' '}
          </button>{' '}
          <button
            onClick={() => onCommentClick(post)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {' '}
            <MessageCircle className="h-4 w-4" /> {post.commentCount > 0 && post.commentCount}{' '}
          </button>{' '}
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            {' '}
            <Share2 className="h-4 w-4" />{' '}
          </button>{' '}
        </div>{' '}
        {post.comments && post.comments.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-2">
            {' '}
            {post.comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                {' '}
                <Avatar className="h-6 w-6">
                  {' '}
                  <AvatarImage src={c.user.avatarUrl || undefined} />{' '}
                  <AvatarFallback className="text-[10px]">
                    {(c.user.name || '?')[0]}
                  </AvatarFallback>{' '}
                </Avatar>{' '}
                <div>
                  {' '}
                  <span className="text-xs font-medium">{c.user.name}</span>{' '}
                  <p className="text-xs text-muted-foreground">{c.content}</p>{' '}
                </div>{' '}
              </div>
            ))}{' '}
            {post.commentCount > 2 && (
              <button
                onClick={() => onCommentClick(post)}
                className="text-xs text-primary hover:underline"
              >
                {' '}
                View all {post.commentCount} comments{' '}
              </button>
            )}{' '}
          </div>
        )}{' '}
      </CardContent>{' '}
    </Card>
  );
}
function getTimeAgo(date: string) {
  const sec = (Date.now() - new Date(date).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d`;
  return `${Math.floor(sec / 2592000)}mo`;
}
