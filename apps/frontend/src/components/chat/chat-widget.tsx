'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { ease, spring, transition } from '@/lib/motion';
import { useTranslations } from 'next-intl';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, X, Send, Loader2, User, Bot } from 'lucide-react';
import { skipSocket, socketOptions } from '@/lib/realtime';

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderType: string;
  content: string;
  createdAt: string;
}

export function ChatWidget() {
  const t = useTranslations('ui.chatWidget');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [unavailable, setUnavailable] = useState(skipSocket());
  const [showWelcome, setShowWelcome] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-prompt welcome after 15s on initial visit
  useEffect(() => {
    const shown = sessionStorage.getItem('chat-welcome-shown');
    if (!shown) {
      const timer = setTimeout(() => {
        setOpen(true);
        setShowWelcome(true);
        sessionStorage.setItem('chat-welcome-shown', 'true');
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    // Realtime disabled (NEXT_PUBLIC_REALTIME_MODE=polling). There is no REST fallback
    // for chat, so this stays unavailable rather than opening a socket we were told
    // not to open.
    if (skipSocket()) {
      setUnavailable(true);
      setConnecting(false);
      return;
    }
    setUnavailable(false);
    setConnecting(true);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const s = io(`${wsUrl}/chat`, {
      ...socketOptions(),
      autoConnect: true,
    });
    s.on('connect', () => {
      setConnecting(false);
      s.emit('chat:start', { subject: 'Website Support' }, (resp: { conversationId: string }) => {
        setConvId(resp.conversationId);
        s.emit('chat:history', { conversationId: resp.conversationId }, (history: ChatMessage[]) => {
          setMessages(history);
        });
      });
    });
    s.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    s.on('disconnect', () => setConnecting(false));
    // Chat has no REST fallback: `chat:start`, `chat:history` and `chat:message` are
    // socket-only, and the backend exposes no HTTP equivalent. So when the socket gives
    // up we surface "unavailable" instead of retrying forever and pretending.
    s.io.on('reconnect_failed', () => {
      setConnecting(false);
      setUnavailable(true);
    });
    socketRef.current = s;
  }, []);

  useEffect(() => {
    if (open) connectSocket();
    return () => {
      if (!open && socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConvId(null);
      }
    };
  }, [open, connectSocket]);

  const handleSend = () => {
    const s = socketRef.current;
    if (!input.trim() || !s || !convId) return;
    setShowWelcome(false);
    s.emit('chat:message', { conversationId: convId, content: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 end-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
      {open && (
        <m.div
          key="support-chat"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
          exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16, ease: ease.exit } }}
          className="mb-2 flex h-[440px] w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl rtl:origin-bottom-left sm:w-[370px]"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium leading-tight text-foreground">{t('title')}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  {t('replyTime')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('closeChat')}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-background/60 p-4">
            {unavailable && (
              // No REST fallback exists for chat, so say it plainly instead of leaving a
              // composer that silently swallows messages.
              <div role="status" className="rounded-xl border border-border/70 bg-card p-3.5 text-sm text-muted-foreground shadow-xs">
                <p className="font-medium text-foreground">{t('unavailableTitle')}</p>
                <p className="mt-1 text-xs leading-relaxed">
                  {skipSocket()
                    ? t('unavailablePolling')
                    : t('unavailableConnection')}{' '}
                  {t('unavailableAlternative')}
                </p>
              </div>
            )}
            {!unavailable && showWelcome && messages.length === 0 && (
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { ...transition.enter, delay: 0.1 } }}
                className="flex items-start gap-2.5"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-ss-md border border-border/70 bg-card px-3.5 py-2.5 text-sm shadow-xs">
                  <p className="font-medium text-foreground">{t('greeting')}</p>
                  <p className="mt-1 text-muted-foreground">{t('greetingBody')}</p>
                </div>
              </m.div>
            )}
            <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <m.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                className={`flex items-start gap-2.5 ${msg.senderType === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${msg.senderType === 'user' ? 'bg-muted' : 'bg-primary/10'}`}>
                  {msg.senderType === 'user' ? <User className="size-3.5 text-muted-foreground" /> : <Bot className="size-3.5 text-primary" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${msg.senderType === 'user' ? 'rounded-se-md bg-muted text-foreground' : 'rounded-ss-md border border-border/70 bg-card text-foreground shadow-xs'}`}>{msg.content}</div>
              </m.div>
            ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
          {!unavailable && (
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-border-strong focus-within:shadow-md">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('messagePlaceholder')}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                aria-label={t('messageInputLabel')}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || connecting}
                className="pressable flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                aria-label={t('sendMessage')}
              >
                {connecting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
          )}
        </m.div>
      )}
      </AnimatePresence>
      <m.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -2, transition: spring.smooth }}
        whileTap={{ scale: 0.92, transition: spring.snappy }}
        className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:shadow-xl"
        aria-label={open ? t('closeChat') : t('openChat')}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            key={open ? 'close' : 'open'}
            className="flex"
            initial={{ opacity: 0, rotate: open ? -90 : 90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1, transition: spring.smooth }}
            exit={{ opacity: 0, scale: 0.6, transition: transition.leave }}
          >
            {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
          </m.span>
        </AnimatePresence>
      </m.button>
    </div>
  );
}
