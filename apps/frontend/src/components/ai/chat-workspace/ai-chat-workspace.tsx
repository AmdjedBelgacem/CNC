'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive,
  Bot,
  Check,
  History,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import {
  getAiErrorMessage,
  isAiAvailable,
  useAiChat,
  useAiConversations,
  useAiConversation,
  useAiMessageFeedback,
  useArchiveAiConversation,
  useRateAiMessage,
  usePublicAiConfig,
  useRenameAiConversation,
} from '@/hooks/use-ai-assistant';
import { useAiAssistantContext } from '@/components/ai/ai-assistant-context';
import {
  AiReferenceCard,
  AiSourceBadge,
  AiTranscript,
  groupConversationsByTime,
  relativeTime,
  type AiBubble,
} from '@/components/ai/ai-chat-parts';
import type { AiChatCitation } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const MAX_MESSAGES = 200;

export function AiChatWorkspace({
  conversationId: routeConversationId = null,
}: {
  conversationId?: string | null;
}) {
  const t = useTranslations('aiChat');
  const ta = useTranslations('aiAssistant');
  const locale = useLocale();
  const router = useRouter();
  // `new` is a sentinel for "start a thread", never a real id.
  const activeId = routeConversationId && routeConversationId !== 'new' ? routeConversationId : null;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Cookie auth resolves asynchronously; without this the page flashes the
  // sign-in gate on every cold load and a slow rotation looks like a logout.
  const authHydrated = useAuthStore((state) => state.hydrated);
  const config = usePublicAiConfig(true);
  const available = isAiAvailable(config.data, isAuthenticated);
  const chat = useAiChat(isAuthenticated ? 'authenticated' : 'public');

  const {
    openAssistant,
    setConversationId,
    sourceRef: activeReference,
    clearLessonContext,
    resetThread,
  } = useAiAssistantContext();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [messages, setMessages] = useState<AiBubble[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [failedTurn, setFailedTurn] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = useAiConversations({ search: debounced || undefined, limit: 50 }, isAuthenticated);
  const rate = useRateAiMessage();
  const myFeedback = useAiMessageFeedback(activeId, isAuthenticated);

  const rateMessage = (messageId: string, rating: number) => {
    // Optimistic: the thumb must respond instantly, and the vote is the member's
    // own so there is nothing to re-derive.
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, rating: rating === 0 ? undefined : rating } : message,
      ),
    );
    rate.mutate(
      { messageId, rating },
      {
        onError: () => {
          setMessages((current) =>
            current.map((message) => (message.id === messageId ? { ...message, rating: undefined } : message)),
          );
        },
      },
    );
  };
  const rename = useRenameAiConversation();
  const archive = useArchiveAiConversation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [manageError, setManageError] = useState('');

  // `router.push('/ai/chat')` is a no-op when we are already there, so the reset
  // has to happen in state as well as in the URL.
  useEffect(() => {
    if (!activeId) requestAnimationFrame(() => composerRef.current?.focus());
  }, [activeId]);

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    setError('');
    setFailedTurn(null);
    setEditingId(null);
    setManageError('');
    setConversationId(null);
    clearLessonContext();
    resetThread();
    if (activeId) router.push('/ai/chat');
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setManageError('');
  };

  const commitRename = async () => {
    if (!editingId) return;
    const title = draftTitle.trim();
    if (!title) {
      setManageError(t('titleRequired'));
      return;
    }
    try {
      await rename.mutateAsync({ id: editingId, title });
      setEditingId(null);
    } catch {
      setManageError(t('renameFailed'));
    }
  };

  const archiveThread = async (id: string) => {
    setManageError('');
    try {
      await archive.mutateAsync(id);
      // Leaving the thread you just archived reads better than a 404.
      if (activeId === id) router.push('/ai/chat');
    } catch {
      setManageError(t('archiveFailed'));
    }
  };
  const active = useAiConversation(activeId, isAuthenticated && !!activeId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Hydrate the transcript whenever the deep-linked conversation changes, and
  // clear it when the route points at "new" so the start state actually appears.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setError('');
      setFailedTurn(null);
      return;
    }
    if (!active.data) return;
    setMessages(
      active.data.messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => {
          const meta = (message.meta ?? {}) as Record<string, unknown>;
          return {
            id: message.id,
            role: message.role as 'user' | 'assistant',
            content: message.content,
            citations: (message.citations as AiChatCitation[] | null) ?? undefined,
            createdAt: message.createdAt,
            usedWeb: meta.usedWeb === true,
          };
        })
        .slice(-MAX_MESSAGES),
    );
    setError('');
    setFailedTurn(null);
  }, [activeId, active.data?.id, active.data?.messages?.length]);

  // A disabled list (auth still resolving) must read as loading, not as an empty
  // history — otherwise a cold load claims you have no conversations.
  const historyLoading = !authHydrated || (list.isPending && list.isFetching);

  // Fold the member's stored votes into the bubbles once they arrive.
  useEffect(() => {
    const votes = myFeedback.data?.data;
    if (!votes?.length) return;
    const byMessage = new Map(votes.map((vote) => [vote.messageId, vote.rating]));
    setMessages((current) =>
      current.map((message) =>
        byMessage.has(message.id) ? { ...message, rating: byMessage.get(message.id) } : message,
      ),
    );
  }, [myFeedback.data?.data]);

  const groups = useMemo(
    () => groupConversationsByTime(list.data?.data ?? []),
    [list.data?.data],
  );

  const send = async () => {
    const message = input.trim();
    if (!message || !available) return;
    const sourceRef = activeId ? undefined : activeReference;
    setInput('');
    setError('');
    setFailedTurn(null);
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'user', content: message, pending: true },
    ]);
    try {
      const result = await chat.mutateAsync({
        message,
        history: messages
          .filter((item) => !item.failed)
          .slice(-12)
          .map((item) => ({ role: item.role, content: item.content })),
        conversationId: activeId ?? undefined,
        ...(sourceRef ? { sourceRef } : {}),
        locale: locale === 'ar' ? 'ar' : 'en',
      });
      setMessages((current) => [
        ...current.map((item) => (item.pending ? { ...item, pending: false } : item)),
        {
          id: activeId ? result.requestId : `local-${result.requestId}`,
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
          usedWeb: result.usedWeb === true,
        },
      ]);
      // The first turn mints the conversation server-side: follow it there so
      // the page and the modal stay on the same thread.
      if (!activeId && result.conversationId) {
        setConversationId(result.conversationId);
        router.replace(`/ai/chat/${result.conversationId}`);
        void list.refetch();
      }
    } catch (caught) {
      const message_ = getAiErrorMessage(caught);
      setError(message_);
      setFailedTurn(message);
      setMessages((current) =>
        current.map((item, index) =>
          index === current.length - 1 && item.role === 'user'
            ? { ...item, pending: false, failed: true }
            : item,
        ),
      );
    }
  };


  if (!isAuthenticated && authHydrated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-24">
        <EmptyState
          icon={Sparkles}
          title={t('signInTitle')}
          description={t('signInDescription')}
          action={
            <Button asChild>
              <Link href="/login?returnUrl=/ai/chat">{ta('signIn')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const historyPanel = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-foreground">
            {t('history')}
          </h2>
          <Button size="sm" onClick={startNewChat} aria-label={t('newChat')}>
            <Plus className="size-4" />
            {t('newChat')}
          </Button>
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-9"
          />
        </div>
      </div>

      {manageError && (
        <p role="alert" className="border-b border-destructive/25 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {manageError}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState title={t('loadFailed')} onRetry={() => void list.refetch()} compact />
        ) : (list.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <History className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {search ? t('noResults') : t('emptyTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? t('noResultsHint') : t('emptyHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.group}>
                <p className="px-2 pb-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t(`groups.${group.group}`)}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const selected = item.id === activeId;
                    return (
                      <li key={item.id}>
                        <div className="group relative">
                        <Link
                          href={`/ai/chat/${item.id}`}
                          onClick={() => setDrawerOpen(false)}
                          aria-current={selected ? 'page' : undefined}
                          className={cn(
                            'block rounded-lg border px-3 py-2 pe-9 transition-colors',
                            selected
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-transparent hover:bg-muted',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                            {item.source !== 'general' && <AiSourceBadge source={item.source} />}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {item.lastMessage || t('noPreview')}
                          </p>
                          <p className="mt-1 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground/80">
                            {relativeTime(item.lastMessageAt, locale)} · {t('messageCount', { count: item.messageCount })}
                          </p>
                        </Link>
                        {editingId === item.id ? (
                          <form
                            className="mt-2 flex items-center gap-1"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void commitRename();
                            }}
                          >
                            <Input
                              value={draftTitle}
                              onChange={(event) => setDraftTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') setEditingId(null);
                              }}
                              maxLength={200}
                              autoFocus
                              aria-label={t('renameTitle')}
                              className="h-8 text-xs"
                            />
                            <Button type="submit" size="icon-xs" disabled={rename.isPending} aria-label={t('saveTitle')}>
                              <Check />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setEditingId(null)}
                              aria-label={t('cancelRename')}
                            >
                              <X />
                            </Button>
                          </form>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="absolute end-2 top-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                aria-label={t('manageThread')}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => startRename(item.id, item.title)}>
                                <Pencil className="size-4" />
                                {t('rename')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void archiveThread(item.id)}>
                                <Archive className="size-4" />
                                {t('archive')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-container-max gap-0">
      {/* History rail: persistent on desktop, a drawer on small screens. */}
      <aside className="hidden w-80 shrink-0 border-e border-border lg:block">
        {historyPanel}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('closeHistory')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div className="absolute inset-y-0 start-0 w-[85vw] max-w-sm border-e border-border bg-background shadow-xl">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label={t('closeHistory')}>
                <X />
              </Button>
            </div>
            <div className="h-[calc(100%-3rem)]">{historyPanel}</div>
          </div>
        </div>
      )}

      {/* Transcript + composer */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openHistory')}
          >
            <Menu />
          </Button>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold text-foreground">
              {activeId ? active.data?.title || t('loading') : t('newChatTitle')}
            </h1>
            <p className="truncate font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              {activeId ? t('savedBadge') : t('unsavedHint')}
            </p>
          </div>
          {activeId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAssistant({ conversationId: activeId })}
              aria-label={t('openInModal')}
            >
              <Bot className="size-4" />
              <span className="hidden sm:inline">{t('openInModal')}</span>
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {activeReference && !activeId && (
            <AiReferenceCard sourceRef={activeReference} className="mb-5 max-w-3xl" />
          )}
          {activeId && active.data?.sourceRef && (
            <AiReferenceCard sourceRef={active.data.sourceRef} className="mb-5 max-w-3xl" />
          )}

          {activeId && active.isPending && active.isFetching ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full max-w-2xl rounded-lg" />
              ))}
            </div>
          ) : active.isError ? (
            <ErrorState
              title={t('loadFailed')}
              onRetry={() => void active.refetch()}
              className="max-w-2xl"
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl">
              <AiTranscript
                messages={messages}
                isPending={chat.isPending}
                onRate={activeId ? rateMessage : undefined}
                onRetry={() => {
                  if (failedTurn) void send();
                }}
                emptyState={
                  <div className="rounded-lg border border-border bg-muted/30 p-5">
                    <p className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                      <Sparkles className="size-4 text-primary" />
                      {activeReference ? t('groundedTitle') : t('welcomeTitle')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {activeReference ? t('groundedHint') : t('welcomeHint')}
                    </p>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(['factCheckPost', 'courseQuestion', 'lessonQuestion', 'productQuestion'] as const).map(
                        (key) => (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => setInput(t(`prompts.${key}`))}
                              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-start text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                            >
                              {t(`promptLabels.${key}`)}
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                }
              />
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mx-auto w-full max-w-3xl">
            {error && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                <X className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 break-words">{error}</span>
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="space-y-2"
            >
              <Textarea
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={3}
                maxLength={4000}
                placeholder={available ? t('placeholder') : ta('unavailable')}
                disabled={!available || chat.isPending}
                aria-label={ta('inputLabel')}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                  {t('groundedNote')}
                </p>
                <Button type="submit" size="sm" disabled={!input.trim() || chat.isPending || !available}>
                  {chat.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  {t('send')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
