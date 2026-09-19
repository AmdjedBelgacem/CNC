'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Loader2, Send } from 'lucide-react';
interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
}
interface CommentsDrawerProps {
  postId: string;
  postContent: string;
  open: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
}
export function CommentsDrawer({
  postId,
  postContent,
  open,
  onClose,
  onCommentAdded,
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/proxy/feed/${postId}/comments?limit=50`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, open]);
  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/proxy/feed/${postId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      });
      setText('');
      onCommentAdded();
      const updated = await fetch(`/api/proxy/feed/${postId}/comments?limit=50`, {
        credentials: 'include',
      }).then((r) => r.json());
      setComments(updated);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900"
      onClick={onClose}
    >
      {' '}
      <div
        className="w-full sm:max-w-md max-h-[70vh] rounded-t-xl sm:rounded-xl border bg-card shadow-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {' '}
        <div className="flex items-center justify-between border-b px-4 py-3">
          {' '}
          <h3 className="font-semibold text-sm">Comments</h3>{' '}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            {' '}
            <X className="h-4 w-4" />{' '}
          </Button>{' '}
        </div>{' '}
        <div className="px-4 py-2 border-b bg-muted/30">
          {' '}
          <p className="text-sm text-muted-foreground line-clamp-2">{postContent}</p>{' '}
        </div>{' '}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {' '}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                {' '}
                <Avatar className="h-7 w-7 shrink-0">
                  {' '}
                  <AvatarImage src={c.user.avatarUrl || undefined} />{' '}
                  <AvatarFallback className="text-[10px]">
                    {(c.user.name || '?')[0]}
                  </AvatarFallback>{' '}
                </Avatar>{' '}
                <div>
                  {' '}
                  <span className="text-xs font-medium">{c.user.name}</span>{' '}
                  <p className="text-sm text-muted-foreground">{c.content}</p>{' '}
                </div>{' '}
              </div>
            ))
          )}{' '}
          <div ref={bottomRef} />{' '}
        </div>{' '}
        <div className="border-t p-3 flex gap-2">
          {' '}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none"
            onKeyDown={(e) =>
              e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())
            }
          />{' '}
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!text.trim() || submitting}
            onClick={handleSubmit}
          >
            {' '}
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}{' '}
          </Button>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
