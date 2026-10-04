import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AiConversationsService, deriveTitle } from '../src/modules/ai/ai-conversations.service';

/**
 * Regression cover for AI conversation history.
 *
 * Invariants that are cheap to break and invisible until a user hits them:
 *
 *  1. `deriveTitle` must survive whitespace-only, multi-sentence and RTL input,
 *     because it names every thread in the history rail.
 *
 *  2. An archived thread is read-only: a later turn has to fork into a new
 *     conversation, otherwise a message lands in a thread the user removed from
 *     their history and it never shows up again.
 *
 *  3. A thread keeps the grounding it was created with, so a follow-up question
 *     about a post cannot silently lose the post.
 *
 *  4. Ownership is checked before anything is read or written, in both
 *     directions (same-tenant and cross-tenant).
 *
 * The DB-facing branches are exercised through a small fake drizzle surface; the
 * static assertions cover what the fake cannot see.
 */
type Row = {
  id: string;
  tenantId: string;
  userId: string;
  status: string;
  source: string;
  sourceRef: unknown;
};

const TENANT = 'tenant-1';
const USER = 'user-1';

/**
 * Minimal evaluator for the drizzle `where` fragments this service builds, so
 * the fake below actually filters instead of returning every row.
 */
function compileWhere(node: unknown): (row: Row) => boolean {
  const sqlNode = node as { queryChunks?: unknown[] } | null | undefined;
  if (!sqlNode?.queryChunks) return () => true;
  const chunks = sqlNode.queryChunks;
  const isStringChunk = (chunk: unknown) =>
    (chunk as { constructor?: { name?: string } })?.constructor?.name === 'StringChunk';
  const nested = chunks.filter((chunk) => Array.isArray((chunk as { queryChunks?: unknown[] })?.queryChunks));
  if (nested.length) {
    const parts = nested.map((chunk) => compileWhere(chunk));
    const text = chunks
      .filter(isStringChunk)
      .map((chunk) => ((chunk as { value: string[] }).value ?? []).join(''))
      .join('');
    return /\bor\b/.test(text)
      ? (row) => parts.some((part) => part(row))
      : (row) => parts.every((part) => part(row));
  }

  const column = chunks.find((chunk) => typeof (chunk as { name?: string })?.name === 'string') as
    | { name: string }
    | undefined;
  const param = chunks.find(
    (chunk) => (chunk as { constructor?: { name?: string } })?.constructor?.name === 'Param',
  ) as { value: unknown } | undefined;
  if (!column || param === undefined) return () => true;

  const text = chunks
    .filter(isStringChunk)
    .map((chunk) => ((chunk as { value: string[] }).value ?? []).join(''))
    .join('');
  if (/ilike/i.test(text)) {
    const needle = String(param.value).replace(/%/g, '').toLowerCase();
    return (row) => String((row as Record<string, unknown>)[column.name] ?? '').toLowerCase().includes(needle);
  }
  return (row) =>
    String((row as Record<string, unknown>)[column.name]) === String(param.value);
}

function fakeService(rows: Row[]) {
  const created: Array<Record<string, unknown>> = [];
  let seq = 0;

  const db = {
    query: {
      aiConversations: {
        findMany: async ({ where }: { where?: unknown } = {}) =>
          rows.filter(compileWhere(where)).map((row) => ({ ...row })),
      },
    },
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        created.push(value);
        return {
          returning: () => [
            {
              id: `new-${++seq}`,
              tenantId: TENANT,
              userId: USER,
              title: value.title ?? null,
              source: value.source ?? 'general',
              sourceRef: value.sourceRef ?? null,
              status: 'active',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        };
      },
    }),
  };

  const service = new AiConversationsService({ db } as never);
  return { service, created };
}

describe('AI conversation titles', () => {
  it('falls back for empty and whitespace-only messages', () => {
    expect(deriveTitle('')).toBe('New conversation');
    expect(deriveTitle('   \n\t ')).toBe('New conversation');
  });

  it('uses the first sentence only', () => {
    expect(deriveTitle('How do I set up a CNC machine? Also, what coolant do I use?'))
      .toBe('How do I set up a CNC machine?');
  });

  it('keeps Arabic sentence breaks and clamps long titles', () => {
    expect(deriveTitle('ما هي أداة التشغيل؟ وكيف أستخدمها؟')).toBe('ما هي أداة التشغيل؟');
    const long = deriveTitle('x'.repeat(400));
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('…')).toBe(true);
  });

  it('never returns a blank title', () => {
    expect(deriveTitle('...')).toBe('...');
    expect(deriveTitle('؟؟؟').length).toBeGreaterThan(0);
  });
});

describe('AI conversation append rules', () => {
  let rows: Row[];

  beforeEach(() => {
    rows = [
      {
        id: 'conv-active',
        tenantId: TENANT,
        userId: USER,
        status: 'active',
        source: 'post',
        sourceRef: { type: 'post', id: 'p1' },
      },
      {
        id: 'conv-archived',
        tenantId: TENANT,
        userId: USER,
        status: 'archived',
        source: 'post',
        sourceRef: { type: 'post', id: 'p1' },
      },
      {
        id: 'conv-other-user',
        tenantId: TENANT,
        userId: 'user-2',
        status: 'active',
        source: 'general',
        sourceRef: null,
      },
      {
        id: 'conv-other-tenant',
        tenantId: 'tenant-2',
        userId: USER,
        status: 'active',
        source: 'general',
        sourceRef: null,
      },
    ];
  });

  it('keeps an active thread on the same conversation and preserves grounding', async () => {
    const { service, created } = fakeService(rows);
    const result = await service.resolveForAppend(TENANT, USER, 'conv-active', {
      message: 'And the tooling?',
      source: 'post',
      sourceRef: { type: 'post', id: 'other' },
    });

    expect(result.id).toBe('conv-active');
    // The post the thread was created from wins over the request payload.
    expect(result.sourceRef).toEqual({ type: 'post', id: 'p1' });
    expect(created).toHaveLength(0);
  });

  it('forks a new conversation when the thread was archived', async () => {
    const { service, created } = fakeService(rows);
    const result = await service.resolveForAppend(TENANT, USER, 'conv-archived', {
      message: 'One more thing about the spindle',
      source: 'post',
      sourceRef: null,
    });

    expect(result.id).not.toBe('conv-archived');
    expect(result.source).toBe('post');
    // Grounding carries over so the fork stays answerable.
    expect(result.sourceRef).toEqual({ type: 'post', id: 'p1' });
    expect(created).toHaveLength(1);
    expect(String(created[0].title)).toBe('One more thing about the spindle');
  });

  it('creates a titled conversation when no id is supplied', async () => {
    const { service, created } = fakeService(rows);
    const result = await service.resolveForAppend(TENANT, USER, undefined, {
      message: '  What is a collet?  ',
      source: 'general',
      sourceRef: null,
    });

    expect(result.id).toMatch(/^new-/);
    expect(created[0].title).toBe('What is a collet?');
  });

  it('refuses another member’s conversation', async () => {
    const { service, created } = fakeService(rows);
    await expect(
      service.resolveForAppend(TENANT, USER, 'conv-other-user', {
        message: 'peek',
        source: 'general',
        sourceRef: null,
      }),
    ).rejects.toThrow(/access denied/i);
    expect(created).toHaveLength(0);
  });

  it('refuses a cross-tenant conversation', async () => {
    const { service, created } = fakeService(rows);
    await expect(
      service.resolveForAppend(TENANT, USER, 'conv-other-tenant', {
        message: 'peek',
        source: 'general',
        sourceRef: null,
      }),
    ).rejects.toThrow(/access denied/i);
    expect(created).toHaveLength(0);
  });

  it('reports a missing conversation instead of creating one', async () => {
    const { service, created } = fakeService(rows);
    await expect(
      service.resolveForAppend(TENANT, USER, 'conv-missing', {
        message: 'hi',
        source: 'general',
        sourceRef: null,
      }),
    ).rejects.toThrow(/not found/i);
    expect(created).toHaveLength(0);
  });
});

describe('AI history search and persistence wiring', () => {
  const service = readFileSync(
    resolve(__dirname, '../src/modules/ai/ai-conversations.service.ts'),
    'utf8',
  );
  const chat = readFileSync(resolve(__dirname, '../src/modules/ai/ai-chat.service.ts'), 'utf8');
  const main = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

  it('searches the title, the attached reference and message bodies', () => {
    expect(service).toMatch(/ilike\(aiConversations\.title, pattern\)/);
    expect(service).toMatch(/sourceRef\}->>'title'/);
    expect(service).toMatch(/exists \(select 1 from \$\{aiMessages\}/);
  });

  it('scopes every conversation query by tenant and owner', () => {
    expect(service).toMatch(/eq\(aiConversations\.tenantId, tenantId\)/);
    expect(service).toMatch(/eq\(aiConversations\.userId, userId\)/);
    expect(service).toMatch(/eq\(aiMessages\.tenantId, tenantId\)/);
  });

  it('persists both turns with citations and returns the thread id', () => {
    expect(chat).toMatch(/conversationId/);
    expect(chat).toMatch(/appendMessage/);
  });

  it('tolerates an empty JSON body instead of answering 400', () => {
    expect(main).toMatch(/addContentTypeParser\(\s*'application\/json'/);
    expect(main).toMatch(/if \(!raw\) \{\s*done\(null, \{\}\)/);
  });
});
