'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';

interface Peer {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
}
interface Conversation {
  id: string;
  updatedAt: string;
  peer: Peer;
  lastMessage: { id: string; body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
}
interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}

const MAX_LENGTH = 5000;
const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 5_000;

function PeerAvatar({ peer, className }: { peer: Peer; className?: string }) {
  return (
    <Avatar className={cn('size-10 shrink-0', className)}>
      {peer.avatarUrl && <AvatarImage src={peer.avatarUrl} alt="" />}
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
        {(peer.name || '?').slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function ConversationRow({
  conversation,
  active,
  me,
  locale,
  youLabel,
  onOpen,
}: {
  conversation: Conversation;
  active: boolean;
  me: string | undefined;
  locale: string;
  youLabel: string;
  onOpen: () => void;
}) {
  const { peer, lastMessage, unreadCount } = conversation;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors',
        active ? 'bg-primary/10' : 'hover:bg-muted/60',
      )}
    >
      <PeerAvatar peer={peer} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{peer.name}</span>
          {lastMessage && (
            <span className="shrink-0 text-2xs text-muted-foreground">{timeAgo(lastMessage.createdAt, locale)}</span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-xs', unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
            {lastMessage ? `${lastMessage.senderId === me ? `${youLabel}: ` : ''}${lastMessage.body}` : ''}
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Thread({ conversation, me, onBack }: { conversation: Conversation; me: string | undefined; onBack: () => void }) {
  const t = useTranslations('messages');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ['dm', 'messages', conversation.id],
    queryFn: () => api.get<Message[]>(`/dm/conversations/${conversation.id}/messages?limit=100`),
    refetchInterval: THREAD_POLL_MS,
  });
  // The API returns newest first or oldest first depending on the caller; show oldest at the top.
  const ordered = useMemo(
    () => [...(messages.data ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages.data],
  );
  const lastId = ordered[ordered.length - 1]?.id;
  const lastFromPeer = ordered[ordered.length - 1]?.senderId !== me;

  // Mark the thread read once the newest message is on screen and it is not mine.
  useEffect(() => {
    if (!lastId || !lastFromPeer || conversation.unreadCount === 0) return;
    void api
      .post('/dm/read', { conversationId: conversation.id, messageId: lastId })
      .then(() => queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] }))
      .catch(() => {});
  }, [lastId, lastFromPeer, conversation.id, conversation.unreadCount, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  const send = useMutation({
    mutationFn: (body: string) => api.post<Message>('/dm/messages', { conversationId: conversation.id, body }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['dm', 'messages', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    },
    onError: (error: Error) => toast({ type: 'err', title: t('sendFailed'), description: error.message }),
  });

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label={t('back')}>
          <ArrowLeft className="flip-rtl size-4" />
        </Button>
        <PeerAvatar peer={conversation.peer} className="size-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{conversation.peer.name}</p>
          {conversation.peer.headline && (
            <p className="truncate text-xs text-muted-foreground">{conversation.peer.headline}</p>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn('h-10 w-2/3 rounded-2xl', i % 2 ? 'ms-auto' : '')} />
            ))}
          </div>
        ) : messages.isError ? (
          <ErrorState title={t('loadFailed')} onRetry={() => void messages.refetch()} />
        ) : ordered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('threadEmpty')}</p>
        ) : (
          ordered.map((message) => {
            const mine = message.senderId === me;
            return (
              <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  {message.body}
                  <span className={cn('mt-1 block text-2xs', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {timeAgo(message.createdAt, locale)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border/70 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line. IME composition must not send.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
        />
        <Button type="submit" disabled={!draft.trim() || send.isPending} aria-label={t('send')}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="flip-rtl size-4" />}
        </Button>
      </form>
    </div>
  );
}

function MessagesInner() {
  const t = useTranslations('messages');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const me = useAuthStore((s) => s.user?.id);
  const activeId = params.get('c');

  const conversations = useQuery({
    queryKey: ['dm', 'conversations'],
    queryFn: () => api.get<Conversation[]>('/dm/conversations'),
    refetchInterval: LIST_POLL_MS,
  });
  const list = conversations.data ?? [];
  const active = list.find((c) => c.id === activeId) ?? null;
  const open = (id: string | null) => router.replace(id ? `/messages?c=${id}` : '/messages');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-3xl font-medium tracking-[-0.02em]">{t('title')}</h1>
      <div className="flex h-[70vh] min-h-[420px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
        <aside className={cn('w-full shrink-0 overflow-y-auto border-border/70 p-2 md:block md:w-80 md:border-e', active ? 'hidden' : 'block')}>
          {conversations.isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : conversations.isError ? (
            <ErrorState title={t('loadFailed')} onRetry={() => void conversations.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={MessageCircle} title={t('empty')} description={t('emptyHint')} />
          ) : (
            list.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                me={me}
                locale={locale}
                youLabel={t('you')}
                onOpen={() => open(conversation.id)}
              />
            ))
          )}
        </aside>
        <section className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
          {active ? (
            <Thread key={active.id} conversation={active} me={me} onBack={() => open(null)} />
          ) : (
            <div className="m-auto px-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-3 size-8 opacity-40" />
              {t('selectPrompt')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  );
}
