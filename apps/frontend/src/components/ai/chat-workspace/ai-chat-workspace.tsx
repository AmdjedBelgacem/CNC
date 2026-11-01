'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { coerceLocale, LOCALE_COOKIE } from '@/i18n/config';
import { AnimatePresence, m } from 'framer-motion';
import {
  Archive,
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  History,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
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
import { toast } from '@/components/ui/toast';
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
import { ArabicDialectMenu, useArabicDialectPreference } from '@/components/ai/arabic-dialect-menu';
import {
  AI_COMPOSER_CLASS,
  AI_COMPOSER_TEXTAREA_CLASS,
  AiReferenceCard,
  AiSourceBadge,
  AssistantMark,
  AiTranscript,
  groupConversationsByTime,
  relativeTime,
  type AiBubble,
} from '@/components/ai/ai-chat-parts';
import type { AiChatCitation } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ease, spring, transition } from '@/lib/motion';
import { dialogMotion } from '@/components/ui/dialog';
import { Stagger, StaggerItem } from '@/components/ui/motion';

const MAX_MESSAGES = 200;

export function AiChatWorkspace({
  conversationId: routeConversationId = null,
}: {
  conversationId?: string | null;
}) {
  const t = useTranslations('aiChat');
  const ta = useTranslations('aiAssistant');
  const cookieLocale = typeof document !== 'undefined'
    ? document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.split('=')[1]
    : undefined;
  const locale = coerceLocale(cookieLocale || useLocale());
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
  const [arabicDialect, setArabicDialect] = useArabicDialectPreference();
  const [error, setError] = useState('');
  const [failedTurn, setFailedTurn] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The rail docks at the inline-start edge, so it slides in from there — which
  // is the right-hand side under `dir=rtl`.
  const drawerOffset =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? '100%' : '-100%';

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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
          toast({ type: 'err', title: t('feedbackFailed') });
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
      toast({ type: 'ok', title: t('renamedToast') });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('renameFailed');
      setManageError(message);
      toast({ type: 'err', title: t('renameFailed'), description: message });
    }
  };

  const archiveThread = async (id: string) => {
    setManageError('');
    try {
      await archive.mutateAsync(id);
      // Leaving the thread you just archived reads better than a 404.
      if (activeId === id) router.push('/ai/chat');
      toast({ type: 'ok', title: t('archivedToast') });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('archiveFailed');
      setManageError(message);
      toast({ type: 'err', title: t('archiveFailed'), description: message });
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
        arabicDialect,
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
    // `EmptyState` renders its title as a paragraph, so this signed-out gate had no heading
    // at all — it is what every anonymous visitor to /ai/chat actually sees.
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-24">
        <h1 className="sr-only">{t('newChatTitle')}</h1>
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

  const renderHistory = (variant: 'rail' | 'drawer') => (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">{t('history')}</h2>
          <Button size="sm" variant="outline" onClick={startNewChat} aria-label={t('newChat')} className="rounded-full">
            <Plus className="size-4 text-primary" />
            {t('newChat')}
          </Button>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-9 rounded-full bg-background ps-9 shadow-none"
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {manageError && (
          <m.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: transition.enter }}
            exit={{ opacity: 0, height: 0, transition: transition.leave }}
            className="mx-4 mb-2 overflow-hidden rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {manageError}
          </m.p>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {historyLoading ? (
          <div className="space-y-2 px-1.5 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState title={t('loadFailed')} onRetry={() => void list.refetch()} compact />
        ) : (list.data?.data.length ?? 0) === 0 ? (
          <div className="mx-1.5 mt-2 rounded-xl border border-dashed border-border px-5 py-8 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <History className="size-4.5" aria-hidden />
            </span>
            <p className="mt-3 font-display text-base font-medium text-foreground">
              {search ? t('noResults') : t('emptyTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {search ? t('noResultsHint') : t('emptyHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {groups.map((group) => (
              <section key={group.group}>
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                  {t(`groups.${group.group}`)}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const selected = item.id === activeId;
                    return (
                      <m.li key={item.id} layout="position" transition={spring.layout}>
                        <div className="group relative">
                        {selected && (
                          <m.span
                            layoutId={`ai-history-active-${variant}`}
                            transition={spring.smooth}
                            className="absolute inset-0 rounded-lg border border-border/70 bg-card shadow-xs"
                            aria-hidden
                          />
                        )}
                        <Link
                          href={`/ai/chat/${item.id}`}
                          onClick={() => setDrawerOpen(false)}
                          aria-current={selected ? 'page' : undefined}
                          className={cn(
                            'relative block rounded-lg px-3 py-2 pe-10 transition-colors',
                            selected ? '' : 'hover:bg-foreground/[0.04]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                'line-clamp-1 min-w-0 flex-1 text-sm',
                                selected ? 'font-medium text-foreground' : 'text-foreground/85',
                              )}
                            >
                              {item.title}
                            </span>
                            {item.source !== 'general' && <AiSourceBadge source={item.source} />}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.lastMessage || t('noPreview')}
                          </p>
                          <p className="mt-0.5 text-2xs tabular-nums text-muted-foreground/80">
                            {relativeTime(item.lastMessageAt, locale)} · {t('messageCount', { count: item.messageCount })}
                          </p>
                        </Link>
                        <AnimatePresence initial={false} mode="popLayout">
                        {editingId === item.id ? (
                          <m.form
                            key="rename"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0, transition: transition.enter }}
                            exit={{ opacity: 0, transition: transition.leave }}
                            className="relative mt-1.5 flex items-center gap-1 px-1 pb-1"
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
                          </m.form>
                        ) : (
                          <DropdownMenu key="menu">
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="absolute end-1.5 top-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
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
                        </AnimatePresence>
                        </div>
                      </m.li>
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

  const prompts = ['factCheckPost', 'courseQuestion', 'lessonQuestion', 'productQuestion'] as const;

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-container-max gap-0 bg-background">
      {/* History rail: persistent on desktop, a drawer on small screens. */}
      <aside className="hidden w-72 shrink-0 border-e border-border/70 bg-muted/30 lg:block xl:w-80">
        {renderHistory('rail')}
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" key="ai-history-drawer">
            <m.button
              type="button"
              aria-label={t('closeHistory')}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-overlay/45 backdrop-blur-[3px]"
              {...dialogMotion.overlay}
            />
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label={t('history')}
              initial={{ x: drawerOffset }}
              animate={{ x: 0, transition: spring.gentle }}
              exit={{ x: drawerOffset, transition: { duration: 0.22, ease: ease.exit } }}
              className="absolute inset-y-0 start-0 flex w-[85vw] max-w-sm flex-col border-e border-border/70 bg-background shadow-xl"
            >
              <div className="flex justify-end p-2 pb-0">
                <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label={t('closeHistory')}>
                  <X />
                </Button>
              </div>
              <div className="min-h-0 flex-1">{renderHistory('drawer')}</div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transcript + composer */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/*
          The visible title below lives in a `lg:hidden` header, so at desktop widths this
          page had no heading at all — the conversation title was announced nowhere. This is
          the desktop equivalent, shown only when the mobile one is not, so exactly one h1
          exists at any breakpoint.
        */}
        <h1 className="lg:truncate lg:px-6 lg:pt-4 lg:font-display lg:text-lg lg:font-medium lg:tracking-[-0.015em] lg:text-foreground sr-only lg:not-sr-only">
          {activeId ? active.data?.title || t('loading') : t('newChatTitle')}
        </h1>
        <header className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 lg:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openHistory')}
          >
            <Menu />
          </Button>
          <AssistantMark className="mt-0 lg:hidden" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-medium text-foreground lg:sr-only">
              {activeId ? active.data?.title || t('loading') : t('newChatTitle')}
            </h2>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span
                className={cn('size-1.5 shrink-0 rounded-full', activeId ? 'bg-success' : 'bg-muted-foreground/40')}
                aria-hidden
              />
              {activeId ? t('savedBadge') : t('unsavedHint')}
            </p>
          </div>
          {activeId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAssistant({ conversationId: activeId })}
              aria-label={t('openInModal')}
            >
              <Bot className="size-4" />
              <span className="hidden sm:inline">{t('openInModal')}</span>
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {activeReference && !activeId && (
              <AiReferenceCard sourceRef={activeReference} className="mb-6" />
            )}
            {activeId && active.data?.sourceRef && (
              <AiReferenceCard sourceRef={active.data.sourceRef} className="mb-6" />
            )}

            {activeId && active.isPending && active.isFetching ? (
              <div className="space-y-6">
                <Skeleton className="ms-auto h-12 w-2/3 rounded-2xl" />
                <div className="flex gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              </div>
            ) : active.isError ? (
              <ErrorState
                title={t('loadFailed')}
                onRetry={() => void active.refetch()}
                className="max-w-2xl"
              />
            ) : (
              <AiTranscript
                messages={messages}
                isPending={chat.isPending}
                onRate={activeId ? rateMessage : undefined}
                onRetry={() => {
                  if (failedTurn) void send();
                }}
                emptyState={
                  <div className="flex min-h-[44dvh] flex-col items-center justify-center py-6 text-center">
                    <m.span
                      initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, transition: spring.gentle }}
                      className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <Sparkles className="size-5" />
                    </m.span>
                    <m.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { ...transition.reveal, delay: 0.05 } }}
                      className="mt-5 max-w-xl text-balance font-display text-3xl font-medium leading-tight tracking-[-0.022em] text-foreground sm:text-[2.5rem]"
                    >
                      {activeReference ? t('groundedTitle') : t('welcomeTitle')}
                    </m.p>
                    <m.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { ...transition.reveal, delay: 0.12 } }}
                      className="mt-3 max-w-lg text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground"
                    >
                      {activeReference ? t('groundedHint') : t('welcomeHint')}
                    </m.p>
                    <Stagger as="ul" delay={0.18} gap={0.06} className="mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                      {prompts.map((key, index) => (
                        <StaggerItem as="li" key={key} index={index}>
                          <button
                            type="button"
                            onClick={() => {
                              setInput(t(`prompts.${key}`));
                              requestAnimationFrame(() => composerRef.current?.focus());
                            }}
                            className="card-hover group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-start text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
                          >
                            <span className="min-w-0 flex-1">{t(`promptLabels.${key}`)}</span>
                            <ArrowUpRight
                              className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary rtl:-scale-x-100"
                              aria-hidden
                            />
                          </button>
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </div>
                }
              />
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence initial={false}>
              {error && (
                <m.div
                  role="alert"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: transition.enter }}
                  exit={{ opacity: 0, y: 4, transition: transition.leave }}
                  className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
                >
                  <X className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">{error}</span>
                </m.div>
              )}
            </AnimatePresence>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className={AI_COMPOSER_CLASS}
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
                className={AI_COMPOSER_TEXTAREA_CLASS}
              />
              <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ArabicDialectMenu value={arabicDialect} onChange={setArabicDialect} />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || chat.isPending || !available}
                  className="rounded-xl"
                >
                  {chat.isPending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
                  <span className="sr-only sm:not-sr-only">{t('send')}</span>
                </Button>
              </div>
            </form>
            <p className="mt-2.5 hidden truncate text-center text-xs text-muted-foreground sm:block">
              {t('groundedNote')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
