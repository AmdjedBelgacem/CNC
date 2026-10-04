'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, X, Send, Loader2, User, Bot } from 'lucide-react';

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderType: string;
  content: string;
  createdAt: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
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
    setConnecting(true);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const s = io(`${wsUrl}/chat`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
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
      {open && (
        <div className="mb-2 flex h-[420px] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm shadow-black/30 animate-slide-in-from-bottom sm:w-[360px]">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-card">
                <MessageCircle className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">TITANS Support</p>
                <p className="text-2xs opacity-80">Typically replies in minutes</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-card transition-colors">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {showWelcome && messages.length === 0 && (
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3.5 py-2.5 text-sm max-w-[85%]">
                  <p className="font-medium">Hi there! 👋</p>
                  <p className="mt-1 text-muted-foreground">I&apos;m here to help with courses, products, or anything about our CNC education platform. How can I assist you today?</p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-2.5 ${msg.senderType === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${msg.senderType === 'user' ? 'bg-primary/20' : 'bg-secondary/50'}`}>
                  {msg.senderType === 'user' ? <User className="size-3.5 text-primary" /> : <Bot className="size-3.5 text-primary" />}
                </div>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] ${msg.senderType === 'user' ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-secondary/50'}`}>{msg.content}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="border-t p-3">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                aria-label="Chat message input"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || connecting}
                className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                aria-label="Send message"
              >
                {connecting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:shadow-sm hover:shadow-primary/40 active:scale-95"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
