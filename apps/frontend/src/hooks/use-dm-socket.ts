'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
type DmMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  conversationId: string;
};
export function useDmSocket(
  enabled: boolean,
  handlers: {
    onMessage?: (payload: { conversationId: string; message: DmMessage }) => void;
    onConversationUpdated?: (payload: { conversationId: string }) => void;
    onRead?: (payload: { conversationId: string; messageId: string }) => void;
  },
): void {
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
const s = io(`${wsUrl}/ws`, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = s;
    if (handlers.onMessage) s.on('dm:message', handlers.onMessage);
    if (handlers.onConversationUpdated)
      s.on('dm:conversation:updated', handlers.onConversationUpdated);
    if (handlers.onRead) s.on('dm:read', handlers.onRead);
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [enabled, handlers.onMessage, handlers.onConversationUpdated, handlers.onRead]);
}
