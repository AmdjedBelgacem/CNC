import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { DrizzleService } from '../../database/drizzle.service';
import { ConfigService } from '../../config/config.service';
import { users } from '../../database/schema/users';
import { eq } from 'drizzle-orm';

@WSGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
  ) {}

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as Record<string, unknown> | undefined)?.token as string | undefined;
    if (authToken && typeof authToken === 'string') return authToken;
    const cookieHeader = client.handshake.headers.cookie as string | undefined;
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

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    const payload = await this.verifyToken(token);
    if (!payload) {
      client.disconnect(true);
      return;
    }
    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user || user.accountStatus === 'deleted' || user.accountStatus === 'suspended') {
      client.disconnect(true);
      return;
    }
    // Tenant isolation: trust DB tenant, not query param
    const tenantId = user.tenantId;
    client.data.userId = user.id;
    client.data.tenantId = tenantId;
    client.data.role = user.role;

    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(client.id);
    client.join(`user:${user.id}`);
    client.join(`tenant:${tenantId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) this.userSockets.delete(userId);
    }
  }

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
