import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChatService } from '../src/modules/chat/chat.service';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
const gateway = read('../src/modules/chat/chat.gateway.ts');

/**
 * The support chat had no access control on conversations.
 *
 * Three defects chained into a full exploit:
 *   1. An anonymous socket joined `tenant:<id>` based on a client-supplied
 *      `x-tenant-slug` header. That room broadcasts `chat:new`, which carries
 *      real conversation ids.
 *   2. `chat:history` passed that client-supplied id straight to
 *      `getMessages(conversationId)`, which filtered on nothing.
 *   3. `chat:message` emitted into `conv:<id>` with `server.to(...)`, which
 *      broadcasts whether or not the sender is in the room.
 *
 * Net effect: an unauthenticated visitor subscribed to a victim tenant, harvested
 * conversation ids as they appeared, and could read — and inject into — other
 * people's support conversations.
 */
// A fixed conversation owned by `alice` in `tenant-A`. The authorization logic
// under test is the ownership/tenant/role comparison, not the query builder, so
// the stub returns a known row rather than trying to interpret drizzle's `eq`.
const OWNER = 'alice';
const TENANT = 'tenant-A';
// A real UUID: the service validates the shape of a socket-supplied id before
// using it, and that check is part of what is under test.
const CONV_ID = '11111111-2222-4333-8444-555555555555';
const CONV = { id: CONV_ID, userId: OWNER, tenantId: TENANT } as any;

// The service reaches the database through `drizzle.db`, so the stub mirrors
// that shape.
const db = {
  db: {
    query: { chatConversations: { findFirst: async () => CONV } },
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) }),
  },
} as never;

const svc = new ChatService(db);
// The Nest constructor takes the repo via a decorator parameter property,
// which vitest does not emit, so assign it explicitly. This test is about
// the authorization decision, not dependency injection.
(svc as unknown as { drizzle: unknown }).drizzle = db;
// The Nest constructor takes the repo via a decorator parameter property, which
// vitest does not emit, so assign it explicitly. The test is about the
// authorization decision, not DI.
(svc as unknown as { drizzle: unknown }).drizzle = db;

describe('support chat conversation authorization', () => {
  it('rejects a malformed id without touching the database', async () => {
    // The id came straight off the socket; it must be validated before it is used.
    for (const bad of ['', 'x', '../../etc/passwd', "'; drop table users;--", '1 OR 1=1', 'not-a-uuid']) {
      await expect(
        svc.getConversationForViewer(bad, { userId: 'alice', tenantId: 'tenant-A' }),
      ).resolves.toBeNull();
    }
  });

  it('lets the owner read their own conversation', async () => {
    await expect(
      svc.getConversationForViewer(CONV_ID, { userId: 'alice', tenantId: 'tenant-A' }),
    ).resolves.toBeTruthy();
  });

  it('denies a different user the same conversation', async () => {
    await expect(
      svc.getConversationForViewer(CONV_ID, { userId: 'mallory', tenantId: 'tenant-A' }),
    ).resolves.toBeNull();
  });

  it('denies an anonymous viewer outright', async () => {
    await expect(
      svc.getConversationForViewer(CONV_ID, { tenantId: 'tenant-A' }),
    ).resolves.toBeNull();
  });

  it('denies a role from a different tenant, even a super_admin one', async () => {
    // A role is only meaningful inside the tenant that granted it; checking the
    // role without checking the tenant would let any admin read any chat.
    await expect(
      svc.getConversationForViewer(CONV_ID, {
        userId: 'eve',
        tenantId: 'tenant-B',
        role: 'super_admin',
      }),
    ).resolves.toBeNull();
  });

  it('allows staff of the owning tenant', async () => {
    await expect(
      svc.getConversationForViewer(CONV_ID, {
        userId: 'staff1',
        tenantId: 'tenant-A',
        role: 'admin',
      }),
    ).resolves.toBeTruthy();
  });

  it('a non-staff role gets nothing extra', async () => {
    await expect(
      svc.getConversationForViewer(CONV_ID, {
        userId: 'someone',
        tenantId: 'tenant-A',
        role: 'sponsor',
      }),
    ).resolves.toBeNull();
  });
});

describe('the gateway enforces it on every conversation event', () => {
  it('checks before returning history', () => {
    const history = gateway.slice(gateway.indexOf("'chat:history'"));
    expect(history).toMatch(/getConversationForViewer/);
    expect(history).toMatch(/Not allowed to read/);
  });

  it('checks before posting, because server.to() ignores room membership', () => {
    const message = gateway.slice(gateway.indexOf("'chat:message'"));
    const guardAt = message.indexOf('getConversationForViewer');
    const writeAt = message.indexOf('addMessage');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt, 'the check must come before the write').toBeLessThan(writeAt);
    expect(message).toMatch(/Not allowed to post/);
  });

  it('never lets an anonymous socket join a tenant-wide room', () => {
    // The tenant is chosen by the client, so the room it joins must not be
    // tenant-wide.
    const anon = gateway.slice(gateway.indexOf('Anonymous support path'));
    expect(anon).toMatch(/socket\.join\(`anon:/);
    expect(anon).not.toMatch(/socket\.join\(`tenant:/);
  });

  it('still joins the tenant room for an authenticated user', () => {
    // Guarding the anonymous path must not break the authenticated one.
    const authed = gateway.slice(0, gateway.indexOf('Anonymous support path'));
    expect(authed).toMatch(/socket\.join\(`tenant:/);
  });
});
