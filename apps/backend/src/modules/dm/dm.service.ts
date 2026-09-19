import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { dmConversations, dmParticipants, dmMessages, userBlocks } from '../../database/schema/dm';
import { users } from '../../database/schema/users';
import { eq, and, desc, asc, count, sql, or, ne, gt } from 'drizzle-orm';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class DmService {
  constructor(
    private drizzle: DrizzleService,
    private wsGateway: WsGateway,
  ) {}

  private async ensureSameTenant(tenantId: string, peerId: string) {
    const peer = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, peerId) });
    if (!peer) throw new NotFoundException('User not found');
    if (peer.tenantId !== tenantId) throw new ForbiddenException('Cross-tenant messaging not allowed');
    if (peer.accountStatus === 'deleted' || peer.accountStatus === 'suspended' || peer.isActive === false) {
      throw new ForbiddenException('User not available');
    }
    return peer;
  }

  private async isBlocked(tenantId: string, userA: string, userB: string): Promise<boolean> {
    const rows = await this.drizzle.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.tenantId, tenantId),
          or(
            and(eq(userBlocks.blockerId, userA), eq(userBlocks.blockedId, userB)),
            and(eq(userBlocks.blockerId, userB), eq(userBlocks.blockedId, userA)),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async createOrGetConversation(tenantId: string, me: string, peerId: string) {
    if (me === peerId) throw new BadRequestException('Cannot message yourself');
    await this.ensureSameTenant(tenantId, peerId);
    if (await this.isBlocked(tenantId, me, peerId)) throw new ForbiddenException('Blocked');

    // Find existing 2-participant conversation containing exactly me+peer
    const myConvs = await this.drizzle.db
      .select({ conversationId: dmParticipants.conversationId })
      .from(dmParticipants)
      .where(and(eq(dmParticipants.userId, me), eq(dmParticipants.tenantId, tenantId)));

    for (const { conversationId } of myConvs) {
      const parts = await this.drizzle.db
        .select({ userId: dmParticipants.userId })
        .from(dmParticipants)
        .where(eq(dmParticipants.conversationId, conversationId));
      if (parts.length === 2) {
        const ids = parts.map((p) => p.userId).sort();
        const target = [me, peerId].sort();
        if (ids[0] === target[0] && ids[1] === target[1]) {
          const [conv] = await this.drizzle.db
            .select()
            .from(dmConversations)
            .where(eq(dmConversations.id, conversationId))
            .limit(1);
          if (conv) return conv;
        }
      }
    }

    // Create new conversation + participants atomically
    return await this.drizzle.db.transaction(async (tx) => {
      const [conv] = await tx.insert(dmConversations).values({ tenantId }).returning();
      if (!conv) throw new BadRequestException('Failed to create conversation');
      await tx.insert(dmParticipants).values([
        { conversationId: conv.id, userId: me, tenantId },
        { conversationId: conv.id, userId: peerId, tenantId },
      ]);
      return conv;
    });
  }

  async listConversations(tenantId: string, me: string) {
    const myParts = await this.drizzle.db
      .select({
        conversationId: dmParticipants.conversationId,
        lastReadMessageId: dmParticipants.lastReadMessageId,
        updatedAt: dmConversations.updatedAt,
        convId: dmConversations.id,
      })
      .from(dmParticipants)
      .innerJoin(dmConversations, eq(dmParticipants.conversationId, dmConversations.id))
      .where(and(eq(dmParticipants.userId, me), eq(dmParticipants.tenantId, tenantId)))
      .orderBy(desc(dmConversations.updatedAt));

    const result: Array<{
      id: string;
      tenantId: string;
      updatedAt: Date;
      peer: { id: string; name: string | null; username: string | null; avatarUrl: string | null; headline: string | null } | null;
      lastMessage: { id: string; body: string; senderId: string; createdAt: Date } | null;
      unreadCount: number;
    }> = [];

    for (const row of myParts) {
      const convId = row.conversationId;

      // peer
      const peerPart = await this.drizzle.db
        .select({ userId: dmParticipants.userId })
        .from(dmParticipants)
        .where(and(eq(dmParticipants.conversationId, convId), ne(dmParticipants.userId, me)))
        .limit(1);
      const peerId = peerPart[0]?.userId;
      let peer: { id: string; name: string | null; username: string | null; avatarUrl: string | null; headline: string | null } | null = null;
      if (peerId) {
        const u = await this.drizzle.db.query.users.findFirst({
          where: eq(users.id, peerId),
          columns: { id: true, name: true, username: true, avatarUrl: true, headline: true },
        });
        if (u) peer = { id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl, headline: u.headline };
      }

      // last message
      const [last] = await this.drizzle.db
        .select({ id: dmMessages.id, body: dmMessages.body, senderId: dmMessages.senderId, createdAt: dmMessages.createdAt })
        .from(dmMessages)
        .where(and(eq(dmMessages.conversationId, convId), sql`${dmMessages.deletedAt} IS NULL`))
        .orderBy(desc(dmMessages.createdAt))
        .limit(1);
      const lastMessage = last
        ? { id: last.id, body: last.body, senderId: last.senderId, createdAt: last.createdAt }
        : null;

      // unread count
      let unreadCount = 0;
      const lastReadId = row.lastReadMessageId as string | null;
      if (lastMessage) {
        if (!lastReadId) {
          const [cnt] = await this.drizzle.db
            .select({ c: count() })
            .from(dmMessages)
            .where(and(eq(dmMessages.conversationId, convId), ne(dmMessages.senderId, me), sql`${dmMessages.deletedAt} IS NULL`));
          unreadCount = Number(cnt?.c ?? 0);
        } else {
          const lastRead = await this.drizzle.db
            .select({ createdAt: dmMessages.createdAt })
            .from(dmMessages)
            .where(eq(dmMessages.id, lastReadId))
            .limit(1);
          const since = lastRead[0]?.createdAt;
          if (since) {
            const [cnt] = await this.drizzle.db
              .select({ c: count() })
              .from(dmMessages)
              .where(
                and(
                  eq(dmMessages.conversationId, convId),
                  ne(dmMessages.senderId, me),
                  sql`${dmMessages.deletedAt} IS NULL`,
                  gt(dmMessages.createdAt, since),
                ),
              );
            unreadCount = Number(cnt?.c ?? 0);
          }
        }
      }

      result.push({
        id: convId,
        tenantId,
        updatedAt: row.updatedAt,
        peer,
        lastMessage,
        unreadCount,
      });
    }

    return result;
  }

  async getMessages(tenantId: string, me: string, conversationId: string, limit = 50) {
    const membership = await this.drizzle.db
      .select({ id: dmParticipants.id })
      .from(dmParticipants)
      .where(and(eq(dmParticipants.conversationId, conversationId), eq(dmParticipants.userId, me), eq(dmParticipants.tenantId, tenantId)))
      .limit(1);
    if (membership.length === 0) throw new ForbiddenException('Not a participant');

    const conv = await this.drizzle.db.query.dmConversations.findFirst({ where: eq(dmConversations.id, conversationId) });
    if (!conv || conv.tenantId !== tenantId) throw new NotFoundException('Conversation not found');

    return this.drizzle.db
      .select({ id: dmMessages.id, body: dmMessages.body, senderId: dmMessages.senderId, createdAt: dmMessages.createdAt })
      .from(dmMessages)
      .where(and(eq(dmMessages.conversationId, conversationId), sql`${dmMessages.deletedAt} IS NULL`))
      .orderBy(asc(dmMessages.createdAt))
      .limit(Math.min(limit, 100));
  }

  async sendMessage(tenantId: string, senderId: string, conversationId: string, body: string) {
    if (!body || !body.trim()) throw new BadRequestException('Message body required');
    if (body.length > 5000) throw new BadRequestException('Message too long');

    const parts = await this.drizzle.db
      .select({ userId: dmParticipants.userId })
      .from(dmParticipants)
      .where(and(eq(dmParticipants.conversationId, conversationId), eq(dmParticipants.tenantId, tenantId)));
    if (!parts.some((p) => p.userId === senderId)) throw new ForbiddenException('Not a participant');
    if (parts.length !== 2) throw new BadRequestException('Invalid conversation');

    const peerId = parts.find((p) => p.userId !== senderId)!.userId;
    if (await this.isBlocked(tenantId, senderId, peerId)) throw new ForbiddenException('Blocked');

    const conv = await this.drizzle.db.query.dmConversations.findFirst({ where: eq(dmConversations.id, conversationId) });
    if (!conv || conv.tenantId !== tenantId) throw new NotFoundException('Conversation not found');

    const [msg] = await this.drizzle.db
      .insert(dmMessages)
      .values({ conversationId, senderId, tenantId, body: body.trim() })
      .returning();

    await this.drizzle.db.update(dmConversations).set({ updatedAt: new Date() }).where(eq(dmConversations.id, conversationId));

    // realtime delivery via WsGateway user rooms
    for (const p of parts) {
      this.wsGateway.sendToUser(p.userId, 'dm:message', { conversationId, message: msg });
    }
    // also update conversation list
    for (const p of parts) {
      this.wsGateway.sendToUser(p.userId, 'dm:conversation:updated', { conversationId });
    }

    return msg;
  }

  async markRead(tenantId: string, me: string, conversationId: string, messageId: string) {
    const membership = await this.drizzle.db
      .select({ id: dmParticipants.id })
      .from(dmParticipants)
      .where(and(eq(dmParticipants.conversationId, conversationId), eq(dmParticipants.userId, me), eq(dmParticipants.tenantId, tenantId)))
      .limit(1);
    if (membership.length === 0) throw new ForbiddenException('Not a participant');

    const msg = await this.drizzle.db
      .select({ id: dmMessages.id })
      .from(dmMessages)
      .where(and(eq(dmMessages.id, messageId), eq(dmMessages.conversationId, conversationId)))
      .limit(1);
    if (msg.length === 0) throw new NotFoundException('Message not found');

    await this.drizzle.db
      .update(dmParticipants)
      .set({ lastReadMessageId: messageId })
      .where(and(eq(dmParticipants.conversationId, conversationId), eq(dmParticipants.userId, me)));

    this.wsGateway.sendToUser(me, 'dm:read', { conversationId, messageId });
    return { ok: true };
  }

  async blockUser(tenantId: string, blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
    await this.ensureSameTenant(tenantId, blockedId);
    const [existing] = await this.drizzle.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId), eq(userBlocks.tenantId, tenantId)))
      .limit(1);
    if (existing) return existing;
    const [row] = await this.drizzle.db.insert(userBlocks).values({ tenantId, blockerId, blockedId }).returning();
    return row;
  }

  async unblockUser(tenantId: string, blockerId: string, blockedId: string) {
    await this.drizzle.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId), eq(userBlocks.tenantId, tenantId)));
    return { ok: true };
  }

  async isBlockedPair(tenantId: string, a: string, b: string) {
    return this.isBlocked(tenantId, a, b);
  }
}
