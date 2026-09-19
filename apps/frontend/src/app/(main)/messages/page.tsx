'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Send, Loader2, MessageCircle, Ban, ShieldOff } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useDmSocket } from '@/hooks/use-dm-socket';
interface Peer {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
}
interface LastMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}
interface Conversation {
  id: string;
  tenantId: string;
  updatedAt: string;
  peer: Peer | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
}
interface DmMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}
export default function MessagesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus') || searchParams.get('conversationId');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch('/api/proxy/dm/conversations', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoadingConvs(false);
    }
  }, []);
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/proxy/dm/conversations/${convId}/messages`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      // mark read up to last message
      if (Array.isArray(data) && data.length > 0) {
        const last = data[data.length - 1] as DmMessage;
        fetch('/api/proxy/dm/read', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: convId,
            messageId: last.id,
          }),
        }).catch(() => {});
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);
  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);
  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);
  const handleSelect = (id: string) => {
    setSelectedId(id);
    router.replace(`/messages?focus=${id}`, {
      scroll: false,
    });
  };
  // realtime via cookie-auth socket (stable handlers via refs to avoid reconnect on selection change)
  useDmSocket(!!user, {
    onMessage: useCallback(
      (payload: { conversationId: string; message: DmMessage }) => {
        if (payload.conversationId === selectedIdRef.current) {
          setMessages((prev) => [...prev, payload.message]);
          fetch('/api/proxy/dm/read', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: payload.conversationId,
              messageId: payload.message.id,
            }),
          }).catch(() => {});
        }
        loadConversations();
      },
      [loadConversations],
    ),
    onConversationUpdated: useCallback(() => loadConversations(), [loadConversations]),
  });
  const handleSend = async () => {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/proxy/dm/messages', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedId,
          body: input.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send');
      }
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setInput('');
      // mark read
      fetch('/api/proxy/dm/read', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedId,
          messageId: msg.id,
        }),
      }).catch(() => {});
      loadConversations();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send';
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setSending(false);
    }
  };
  const handleBlock = async (peerId: string) => {
    if (!confirm('Block this user? You will not receive messages from them.')) return;
    await fetch(`/api/proxy/users/${peerId}/block`, {
      method: 'POST',
      credentials: 'include',
    });
    loadConversations();
  };
  const handleUnblock = async (peerId: string) => {
    await fetch(`/api/proxy/users/${peerId}/block`, {
      method: 'DELETE',
      credentials: 'include',
    });
    loadConversations();
  };
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const selectedConv = conversations.find((c) => c.id === selectedId);
  if (!user) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-24 text-center text-muted-foreground">
        Please sign in to view messages.
      </div>
    );
  }
  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {' '}
      <div className="flex h-[70vh] min-h-[500px] overflow-hidden rounded-2xl border bg-card shadow-sm">
        {' '}
        {/* List */}
        <div className="flex w-full max-w-[360px] flex-col border-r bg-card sm:w-[320px]">
          {' '}
          <div className="border-b px-4 py-3">
            {' '}
            <h1 className="text-base font-semibold">Messages</h1>{' '}
            <p className="text-xs text-muted-foreground">
              Tenant-isolated · {conversations.length}
              conversations
            </p>{' '}
          </div>{' '}
          <div className="flex-1 overflow-y-auto">
            {' '}
            {loadingConvs ? (
              <div className="p-4 space-y-3">
                {' '}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                {' '}
                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />{' '}
                <p className="text-sm font-medium">No conversations yet</p>{' '}
                <p className="text-xs text-muted-foreground">
                  Visit a profile and tap Message to start.
                </p>{' '}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {' '}
                {conversations.map((c) => (
                  <li key={c.id}>
                    {' '}
                    <button
                      onClick={() => handleSelect(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60 ${selectedId === c.id ? 'bg-muted' : ''}`}
                    >
                      {' '}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {' '}
                        {(c.peer?.name || c.peer?.username || '?')[0]?.toUpperCase()}
                      </div>{' '}
                      <div className="min-w-0 flex-1">
                        {' '}
                        <p className="truncate text-sm font-medium">
                          {c.peer?.name || c.peer?.username || 'Unknown'}
                        </p>{' '}
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage?.body || 'No messages yet'}
                        </p>{' '}
                      </div>{' '}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {' '}
                        {c.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                            {' '}
                            {c.unreadCount}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </span>{' '}
                      </div>{' '}
                    </button>{' '}
                  </li>
                ))}
              </ul>
            )}
          </div>{' '}
        </div>{' '}
        {/* Thread */}
        <div className="flex flex-1 flex-col">
          {' '}
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
              {' '}
              <div>
                {' '}
                <MessageCircle className="mx-auto h-8 w-8 opacity-30" />{' '}
                <p className="mt-2 text-sm">Select a conversation</p>{' '}
              </div>{' '}
            </div>
          ) : (
            <>
              {' '}
              <div className="flex items-center justify-between border-b px-4 py-3">
                {' '}
                <div className="flex items-center gap-3">
                  {' '}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {' '}
                    {(selectedConv?.peer?.name || '?')[0]?.toUpperCase()}
                  </div>{' '}
                  <div>
                    {' '}
                    <p className="text-sm font-semibold">
                      {selectedConv?.peer?.name || 'Unknown'}
                    </p>{' '}
                    <p className="text-xs text-muted-foreground">
                      {selectedConv?.peer?.headline || selectedConv?.peer?.username || ''}
                    </p>{' '}
                  </div>{' '}
                </div>{' '}
                {selectedConv?.peer && (
                  <div className="flex items-center gap-1">
                    {' '}
                    <button
                      onClick={() => handleBlock(selectedConv.peer!.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Block user"
                    >
                      {' '}
                      <Ban className="h-4 w-4" />{' '}
                    </button>{' '}
                    <button
                      onClick={() => handleUnblock(selectedConv.peer!.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Unblock"
                    >
                      {' '}
                      <ShieldOff className="h-4 w-4" />{' '}
                    </button>{' '}
                  </div>
                )}
              </div>{' '}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {' '}
                {loadingMsgs ? (
                  <div className="space-y-2">
                    {' '}
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === user.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {' '}
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}
                        >
                          {' '}
                          {m.body}
                        </div>{' '}
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />{' '}
              </div>{' '}
              {error && (
                <div className="mx-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
              <div className="border-t p-3">
                {' '}
                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5">
                  {' '}
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />{' '}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    {' '}
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>{' '}
                </div>{' '}
              </div>{' '}
            </>
          )}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
