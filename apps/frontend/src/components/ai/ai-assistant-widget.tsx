'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Check,
  Loader2,
  Maximize2,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AiChatHistoryItem,
  AiChatMode,
  AiChatResponse,
  AiLessonContext,
  AiSourceRef,
} from '@/lib/api/types';
import {
  getAiErrorMessage,
  isAiAvailable,
  useAiChat,
  useAiConversations,
  usePublicAiConfig,
  useRateAiMessage,
} from '@/hooks/use-ai-assistant';
import { positionAbove, triggerBox, visibleViewport, type OverlayPosition } from '@/lib/overlay-position';
import { useAiAssistantContext } from './ai-assistant-context';
import { AiReferenceCard, AiTranscript, type AiBubble } from './ai-chat-parts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const MAX_MESSAGES = 20;
const MAX_HISTORY = 12;
const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/2fa',
  '/callback',
  '/offline',
];

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPublicPath(pathname: string | null): boolean {
  if (!pathname || pathname.startsWith('/admin')) return false;
  return !AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function PublicAiAssistant() {
  const t = useTranslations('aiAssistant');
  const pathname = usePathname();
  const routeEnabled = isPublicPath(pathname);
  const config = usePublicAiConfig(routeEnabled);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authUser = useAuthStore((state) => state.user);
  const available = routeEnabled && isAiAvailable(config.data, isAuthenticated);
  const {
    isOpen,
    lessonContext,
    sourceRef,
    mode,
    prefill,
    conversationId: contextConversationId,
    openAssistant,
    closeAssistant,
    clearLessonContext,
    setConversationId,
    resetThread,
  } = useAiAssistantContext();
  const conversationId = contextConversationId;
  const [messages, setMessages] = useState<AiBubble[]>([]);
  const [input, setInput] = useState('');
  const router = useRouter();
  const [error, setError] = useState('');
  const [chatDisabled, setChatDisabled] = useState(false);
  const [lastRequest, setLastRequest] = useState<{
    message: string;
    history: AiChatHistoryItem[];
    conversationId?: string;
    pageContext?: AiLessonContext;
    mode?: AiChatMode;
    sourceRef?: AiSourceRef;
  } | null>(null);
  // History is only fetched for signed-in members and only when the modal has
  // an actual thread to reconcile against.
  const historyQuery = useAiConversations({ limit: 20 }, isAuthenticated);
  const publicChat = useAiChat('public');
  const authenticatedChat = useAiChat('authenticated');
  const chat = isAuthenticated ? authenticatedChat : publicChat;
  const rateMessageMutation = useRateAiMessage();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Seeded so the first paint already has sane coordinates: the panel CSS reads these vars
  // unconditionally, and an unmeasured frame would otherwise render at the top-left.
  const [panelPosition, setPanelPosition] = useState<OverlayPosition | null>(() => {
    if (typeof window === 'undefined') return null;
    const gutter = 12;
    const viewport = visibleViewport();
    const width = Math.min(420, Math.max(280, viewport.width - gutter * 2));
    return {
      left: Math.max(gutter, viewport.width - width - gutter),
      top: Math.max(gutter, viewport.height - 640 - gutter),
      width,
      height: Math.min(640, Math.max(0, viewport.height - gutter * 2)),
    };
  });
  const requestGenerationRef = useRef(0);
  // A new reference (post/lesson) or a different mode invalidates the thread.
  const groundingKey = `${sourceRef?.type ?? ''}:${sourceRef?.id ?? ''}:${lessonContext?.lessonId ?? ''}:${mode}`;
  const previousContextRef = useRef(groundingKey);

  const authIdentity = isAuthenticated ? `${authUser?.id || 'user'}:${authUser?.tenantId || 'tenant'}` : 'public';
  const previousAuthIdentityRef = useRef(authIdentity);

  useEffect(() => {
    if (previousAuthIdentityRef.current === authIdentity) return;
    previousAuthIdentityRef.current = authIdentity;
    requestGenerationRef.current += 1;
    setMessages([]);
    setInput('');
    setError('');
    setLastRequest(null);
    setChatDisabled(false);
    resetThread();
    publicChat.reset();
    authenticatedChat.reset();
  }, [authIdentity, authenticatedChat, publicChat, resetThread]);

  // A new reference (post/lesson) or a different mode resets the transcript.
  useEffect(() => {
    if (previousContextRef.current === groundingKey) return;
    previousContextRef.current = groundingKey;
    requestGenerationRef.current += 1;
    setMessages([]);
    setInput(prefill);
    setLastRequest(null);
    setChatDisabled(false);
    setError('');
  }, [groundingKey, prefill]);

  // Reopening a saved conversation from history hydrates the transcript.
  useEffect(() => {
    if (!contextConversationId) return;
    if (messages.length > 0) return;
    const match = historyQuery.data?.data?.find((item) => item.id === contextConversationId);
    if (!match) return;
    requestGenerationRef.current += 1;
    setMessages([]);
    setInput('');
    setError('');
  }, [contextConversationId, historyQuery.data]);

  useEffect(() => {
    if (!available && isOpen) {
      closeAssistant();
      clearLessonContext();
    }
  }, [available, clearLessonContext, closeAssistant, isOpen]);

  useEffect(() => {
    if (available) setChatDisabled(false);
  }, [available]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /**
   * Anchors the panel directly ABOVE the trigger button.
   *
   * The panel used to be pinned to the viewport corner (`bottom-[…] end-6`), which put it
   * in a different place from the button it belongs to — and on desktop it was indented a
   * further 72px from where the notification panel sits. Measuring the trigger means the
   * two surfaces line up as a pair and stay correct when the FAB moves (safe-area insets,
   * a shorter transcript, a different breakpoint).
   *
   * Values are physical because `getBoundingClientRect()` is physical, so the panel is
   * applied with `left`/`top` — a logical `start`/`end` would flip sides under `dir=rtl`.
   */
  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        setPanelPosition(null);
        return;
      }
      const box = positionAbove(
        triggerBox(trigger.getBoundingClientRect()),
        visibleViewport(),
      );
      setPanelPosition(box);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (!routeEnabled || config.isPending || !available) return null;

  const history = (): AiChatHistoryItem[] =>
    messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-MAX_HISTORY)
      .map((message) => ({ role: message.role, content: message.content }));

  const runRequest = async (
    request: {
      message: string;
      history: AiChatHistoryItem[];
      conversationId?: string;
      pageContext?: AiLessonContext;
      mode?: AiChatMode;
      sourceRef?: AiSourceRef;
    },
    addUserMessage: boolean,
  ) => {
    if (chat.isPending || chatDisabled) return;
    const requestGeneration = requestGenerationRef.current;
    setError('');
    setLastRequest(request);
    if (addUserMessage) {
      // Optimistic append: the bubble is marked so a failure can offer retry.
      setMessages((current) => [
        ...current,
        {
          id: createId('message'),
          role: 'user' as const,
          content: request.message,
          pending: true,
        },
      ].slice(-MAX_MESSAGES));
    }
    try {
      const result: AiChatResponse = await chat.mutateAsync(request);
      if (requestGeneration !== requestGenerationRef.current) return;
      setMessages((current) => [
        ...current.map((message) => (message.pending ? { ...message, pending: false } : message)),
        {
          id: createId('message'),
          role: 'assistant' as const,
          content: result.answer.slice(0, 20000),
          citations: result.citations,
          usedWeb: result.usedWeb === true,
        },
      ].slice(-MAX_MESSAGES));
      // The server owns the id: the first turn creates the conversation and
      // every later turn continues it.
      if (result.conversationId) setConversationId(result.conversationId);
      setLastRequest(null);
    } catch (caught) {
      if (requestGeneration !== requestGenerationRef.current) return;
      const messageText = getAiErrorMessage(caught);
      setError(messageText);
      setMessages((current) =>
        current.map((message, index) =>
          index === current.length - 1 && message.role === 'user'
            ? { ...message, pending: false, failed: true }
            : message,
        ),
      );
      const status = (caught as { status?: number } | null)?.status;
      if (status === 404 || status === 401 || status === 403) setChatDisabled(true);
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!message) return;
    const request = {
      message,
      history: history(),
      conversationId: conversationId ?? undefined,
      pageContext: lessonContext ?? undefined,
      mode: sourceRef || lessonContext ? mode : undefined,
      sourceRef: sourceRef ?? undefined,
    };
    setInput('');
    await runRequest(request, true);
  };

  // The modal rates the same persisted answers the page does, so a member's
  // verdict is not lost by asking the question in one surface and rating in
  // the other.
  const rateMessage = (messageId: string, rating: number) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, rating: rating === 0 ? undefined : rating } : message,
      ),
    );
    rateMessageMutation.mutate(
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

  const retry = async () => {
    if (lastRequest) await runRequest(lastRequest, false);
  };

  /** "New chat": drops the transcript and the reference, keeping the modal open. */
  const clear = () => {
    requestGenerationRef.current += 1;
    setMessages([]);
    setInput('');
    setError('');
    setLastRequest(null);
    setChatDisabled(false);
    resetThread();
    clearLessonContext();
    chat.reset();
    void historyQuery.refetch();
  };

  /** "Open in Chat": the SAME conversation continues on the full page. */
  const openInChatPage = () => {
    if (!conversationId) {
      router.push('/ai/chat');
      return;
    }
    router.push(`/ai/chat/${conversationId}`);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openAssistant();
      return;
    }
    closeAssistant();
    clearLessonContext();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          size="icon"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] end-4 z-40 size-12 rounded-full shadow-lg sm:bottom-6 sm:end-6"
          aria-label={t('open')}
        >
          <MessageCircle className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        hideClose
        overlayClassName="!bg-black/25 !backdrop-blur-none"
        // `translate: 'none'` is always applied: `.dialog-pop` centres dialogs with the
        // CSS `translate` property, which utility overrides cannot dislodge, and both
        // branches here place the panel in absolute coordinates. See the note in
        // notification-bell.tsx for the off-screen measurements this caused.
        style={
          {
            ...(panelPosition
              ? {
                  '--panel-left': `${panelPosition.left}px`,
                  '--panel-top': `${panelPosition.top}px`,
                  '--panel-width': `${panelPosition.width}px`,
                  '--panel-height': `${panelPosition.height}px`,
                }
              : {}),
            translate: 'none',
          } as CSSProperties
        }
        className="!left-[var(--panel-left)] !top-[var(--panel-top)] !h-[var(--panel-height)] !w-[var(--panel-width)] !max-h-none !max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{t('title')}</DialogTitle>
              <DialogDescription className="truncate text-xs">{t('description')}</DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAuthenticated && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={openInChatPage}
                  className="h-7 px-2 text-xs"
                  aria-label={t('openInChat')}
                  title={t('openInChat')}
                >
                  <Maximize2 className="size-3.5" />
                  <span className="hidden sm:inline">{t('openInChat')}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={clear}
                  disabled={messages.length === 0 || chat.isPending}
                  aria-label={t('newChat')}
                  title={t('newChat')}
                >
                  <Plus />
                </Button>
              </>
            )}
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('close')}>
                <X />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 p-0">
          <div
            className="max-h-[min(52dvh,28rem)] min-h-56 flex-1 space-y-4 overflow-y-auto px-5 py-4"
            role="log"
            aria-live="polite"
          >
            {sourceRef && (
              <AiReferenceCard sourceRef={sourceRef} className="mb-4" onClear={clearLessonContext} />
            )}
            <AiTranscript
              messages={messages}
              onRate={isAuthenticated && conversationId ? rateMessage : undefined}
              isPending={chat.isPending}
              onRetry={() => void retry()}
              emptyState={
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                    <Bot className="size-4" />
                    {t('welcomeTitle')}
                  </div>
                  {sourceRef ? t('welcomeGrounded') : t('welcome')}
                </div>
              }
            />
            <div ref={messageEndRef} />
          </div>
          {lessonContext && (
            <div className="mx-5 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <Check className="size-3.5 shrink-0" />
              {t('contextAttached')}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mx-5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <X className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{error || t('error')}</span>
              {!chatDisabled && lastRequest && (
                <button
                  type="button"
                  className="shrink-0 font-semibold underline"
                  onClick={() => void retry()}
                >
                  {t('retry')}
                </button>
              )}
            </div>
          )}
          <form
            className="space-y-2 border-t border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={chatDisabled ? t('unavailable') : t('placeholder')}
              disabled={chatDisabled || chat.isPending}
              rows={2}
              maxLength={4000}
              aria-label={t('inputLabel')}
            />
            <div className="flex items-center justify-between gap-2">
              {isAuthenticated ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                  onClick={openInChatPage}
                  disabled={messages.length === 0}
                >
                  <RotateCcw className="size-3.5" />
                  {conversationId ? t('savedThread') : t('notSavedYet')}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{t('publicNote')}</span>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || chat.isPending || chatDisabled}
              >
                {chat.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                {t('send')}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
