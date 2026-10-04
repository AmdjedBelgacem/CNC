import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { DrizzleService } from '../../database/drizzle.service';
import { ConfigService } from '../../config/config.service';
import { users } from '../../database/schema/users';
import { tenants } from '../../database/schema/tenants';
import { eq } from 'drizzle-orm';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private chatService: ChatService,
    private drizzle: DrizzleService,
    private config: ConfigService,
  ) {}

  private extractToken(socket: Socket): string | null {
    const authToken = (socket.handshake.auth as Record<string, unknown> | undefined)?.token as string | undefined;
    if (authToken && typeof authToken === 'string') return authToken;
    const cookieHeader = socket.handshake.headers.cookie as string | undefined;
    if (!cookieHeader) return null;
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const idx = c.indexOf('=');
        if (idx === -1) return [c.trim(), ''];
        return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
      }),
    );
    return cookies['access-token'] || cookies['__Host-access'] || cookies['__Host-access-token'] || null;
  }

  private async verifyToken(token: string): Promise<{ sub: string; tenantId: string; type: string; jti?: string } | null> {
    try {
      const secret = this.config.get('JWT_ACCESS_SECRET') || process.env.JWT_ACCESS_SECRET || 'change-me';
      const payload = jwt.verify(token, secret) as { sub: string; tenantId: string; type: string; jti?: string };
      if (payload.type !== 'access') return null;
      return payload;
    } catch {
      return null;
    }
  }

  async handleConnection(socket: Socket) {
    const token = this.extractToken(socket);
    if (token) {
      const payload = await this.verifyToken(token);
      if (payload) {
        const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, payload.sub) });
        if (user && user.accountStatus !== 'deleted' && user.accountStatus !== 'suspended') {
          socket.data.userId = user.id;
          socket.data.tenantId = user.tenantId;
          socket.data.role = user.role;
          socket.join(`user:${user.id}`);
          socket.join(`tenant:${user.tenantId}`);
          return;
        }
      }
      // invalid token -> disconnect authenticated attempt
      socket.disconnect(true);
      return;
    }
    // Anonymous support path.
    //
    // The tenant is taken from a client-supplied header, so this socket must NOT
    // join `tenant:<id>`: that room broadcasts `chat:new` (with real
    // conversation ids) to everyone in it, which let an unauthenticated visitor
    // subscribe to any tenant's support activity and then read those
    // conversations. An anonymous visitor gets its own room and nothing else.
    const slug = (socket.handshake.headers['x-tenant-slug'] as string) || 'cnc-fundamentals';
    try {
      const tenant = await this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
      if (tenant) {
        socket.data.tenantId = tenant.id;
        socket.data.anonymous = true;
        socket.join(`anon:${socket.id}`);
      }
    } catch {}
    // remain anonymous (no userId)
  }

  handleDisconnect(_socket: Socket) {}

  @SubscribeMessage('chat:start')
  async handleStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { subject?: string },
  ) {
    const tenantId = socket.data.tenantId;
    const userId = socket.data.userId;
    const conv = await this.chatService.createConversation(tenantId, userId, data.subject || 'Support');
    if (!conv) return;
    socket.emit('chat:started', { conversationId: conv.id });
    socket.join(`conv:${conv.id}`);
    return { conversationId: conv.id };
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const userId = socket.data.userId;
    // Authorization before the write. `server.to(room).emit` broadcasts to a room
    // whether or not the sender is in it, so without this check any socket could
    // inject messages into any conversation whose id it could name.
    const allowed = await this.chatService.getConversationForViewer(data.conversationId, {
      userId,
      tenantId: socket.data.tenantId,
      role: socket.data.role,
    });
    if (!allowed) {
      socket.emit('chat:error', { message: 'Not allowed to post in that conversation' });
      return null;
    }
    const msg = await this.chatService.addMessage(data.conversationId, userId || 'anonymous', 'user', data.content);
    this.server.to(`conv:${data.conversationId}`).emit('chat:message', msg);
    if (socket.data.tenantId) {
      this.server.to(`tenant:${socket.data.tenantId}`).emit('chat:new', { conversationId: data.conversationId });
    }
    return msg;
  }

  @SubscribeMessage('chat:history')
  async handleHistory(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const allowed = await this.chatService.getConversationForViewer(data.conversationId, {
      userId: socket.data.userId,
      tenantId: socket.data.tenantId,
      role: socket.data.role,
    });
    if (!allowed) {
      socket.emit('chat:error', { message: 'Not allowed to read that conversation' });
      return null;
    }
    const messages = await this.chatService.getMessages(data.conversationId);
    socket.emit('chat:history', messages);
    return messages;
  }
}
