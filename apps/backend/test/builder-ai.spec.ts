import { describe, expect, it, vi } from 'vitest';
import { AI_SAFE_CLASSES, sanitizeAiClassName, type PageLayout } from '@titan/shared';
import { blockCatalog, describeZod } from '../src/modules/builder/ai/block-catalog';
import {
  applyOperations,
  fromAiNode,
  layoutIssues,
  newBuildContext,
  outlineTree,
  toAiTree,
} from '../src/modules/builder/ai/layout-tools';
import { BuilderAiService, parseJsonObject } from '../src/modules/builder/ai/builder-ai.service';
import { builderSystemPrompt } from '../src/modules/builder/ai/prompts';
import { z } from 'zod';

/**
 * The AI page builder.
 *
 * The model's output is never trusted: every node is checked against the block registry and
 * the publish validator. These tests pin the local repairs that keep one bad value from costing
 * a whole extra model call, and the run orchestration with a fake provider.
 */

const page = (): PageLayout => ({
  root: { props: {} },
  content: [
    {
      type: 'section',
      props: {
        id: 's1',
        content: [
          { type: 'heading', props: { id: 'h1', text: 'Old title', as: 'h1' } },
          { type: 'text', props: { id: 't1', text: 'Body' } },
        ],
      },
    },
  ],
});

describe('block catalog', () => {
  it('describes every buildable block once, compactly', () => {
    const catalog = blockCatalog();
    expect(catalog).toContain('### section');
    expect(catalog).toContain('### heading');
    expect(catalog).toContain('slots: content[');
    // Data-bound blocks are never offered for building from scratch.
    expect(catalog).not.toContain('### live-island');
    // Shared spacing and animation props are listed once, not on every block.
    expect(catalog.match(/animStiffness/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(catalog.length).toBeLessThan(24_000);
  });

  it('reads zod shapes as terse types', () => {
    expect(describeZod(z.enum(['a', 'b']).optional())).toBe("'a'|'b'");
    expect(describeZod(z.number().int().min(0).max(10))).toBe('int 0..10');
    expect(describeZod(z.string().max(40))).toBe('string(40)');
  });

  it('keeps the system prompt identical between calls so the provider can cache it', () => {
    expect(builderSystemPrompt()).toBe(builderSystemPrompt());
    expect(builderSystemPrompt()).toContain(AI_SAFE_CLASSES[0]!);
  });
});

describe('class vocabulary', () => {
  it('drops classes Tailwind will not have compiled', () => {
    expect(sanitizeAiClassName('flex gap-4 bg-[#123456] made-up-class md:grid-cols-3')).toBe('flex gap-4 md:grid-cols-3');
  });

  it('keeps classes the page already uses', () => {
    expect(sanitizeAiClassName('cta-row flex', new Set(['cta-row']))).toBe('cta-row flex');
  });

  it('is written out literally so the Tailwind scanner can see every class', () => {
    expect(AI_SAFE_CLASSES).toContain('gap-16');
    expect(AI_SAFE_CLASSES).toContain('md:py-20');
  });
});

describe('AI nodes', () => {
  it('round-trips a page through the flat AI format', () => {
    const tree = toAiTree(page());
    expect(tree[0]).toMatchObject({ type: 'section', id: 's1' });
    expect((tree[0]!.content as unknown[])[0]).toMatchObject({ type: 'heading', id: 'h1', text: 'Old title' });
    const ctx = newBuildContext(page());
    const back = fromAiNode(tree[0], ctx)!;
    expect(layoutIssues({ root: { props: {} }, content: [back] })).toEqual([]);
  });

  it('repairs invalid props and unknown blocks locally instead of failing', () => {
    const ctx = newBuildContext(null);
    const node = fromAiNode(
      {
        type: 'section',
        bg: 'neon-pink',
        content: [
          { type: 'heading', text: 'Hi', as: 'h7' },
          { type: 'marquee', text: 'nope' },
          { type: 'button', props: { label: 'Go', href: '/courses' } },
        ],
      },
      ctx,
    )!;
    expect(node.props?.bg).toBeUndefined();
    const kids = node.props?.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(kids.map((kid) => kid.type)).toEqual(['heading', 'button']);
    expect(kids[0]!.props.as).toBeUndefined();
    // Props nested under "props" (Puck's shape) are accepted too.
    expect(kids[1]!.props.label).toBe('Go');
    expect(ctx.warnings.length).toBeGreaterThan(0);
    expect(layoutIssues({ root: { props: {} }, content: [node] })).toEqual([]);
  });

  it('gives every node a unique id even when the model repeats one', () => {
    const ctx = newBuildContext(null);
    const node = fromAiNode({ type: 'stack', id: 'x', content: [{ type: 'text', id: 'x', text: 'a' }] }, ctx)!;
    const child = (node.props?.content as Array<{ props: { id: string } }>)[0]!;
    expect(node.props?.id).toBe('x');
    expect(child.props.id).not.toBe('x');
  });

  it('outlines a large page with ids', () => {
    expect(outlineTree(toAiTree(page())).join('\n')).toContain('heading #h1 "Old title"');
  });
});

describe('operations', () => {
  it('updates, inserts, moves and removes by id', () => {
    const ctx = newBuildContext(page());
    const result = applyOperations(
      page(),
      [
        { op: 'update', id: 'h1', props: { text: 'New title' } },
        { op: 'insert', parent: 's1', slot: 'content', index: 2, node: { type: 'button', label: 'Enrol', href: '/courses' } },
        { op: 'move', id: 't1', parent: 's1', index: 0 },
        { op: 'remove', id: 'missing' },
      ],
      ctx,
    );
    expect(result.applied).toBe(3);
    expect(result.errors).toEqual(['remove: no block with id "missing".']);
    const kids = result.layout.content[0]!.props!.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(kids.map((kid) => kid.type)).toEqual(['text', 'heading', 'button']);
    expect(kids[1]!.props.text).toBe('New title');
    expect(layoutIssues(result.layout)).toEqual([]);
  });

  it('keeps a node\'s children when only its props change', () => {
    const result = applyOperations(page(), [{ op: 'update', id: 's1', props: { bg: 'muted' } }], newBuildContext(page()));
    const section = result.layout.content[0]!;
    expect(section.props?.bg).toBe('muted');
    expect((section.props?.content as unknown[]).length).toBe(2);
  });

  it('does not touch the original layout', () => {
    const original = page();
    applyOperations(original, [{ op: 'remove', id: 'h1' }], newBuildContext(original));
    expect((original.content[0]!.props!.content as unknown[]).length).toBe(2);
  });
});

describe('reply parsing', () => {
  it('finds the JSON object inside fences and prose', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Sure! {"a":{"b":"}"}} hope that helps')).toEqual({ a: { b: '}' } });
    expect(parseJsonObject('no json')).toBeNull();
  });
});

describe('runs', () => {
  const runtime = {
    tenantId: 't',
    provider: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'sk-test-key',
    primaryModel: 'deepseek-chat',
    fallbackModel: null,
    timeoutMs: 15000,
    maxTokens: 800,
    temperature: 0.3,
    embeddingModel: null,
    embeddingBaseUrl: null,
  };

  function makeService(replies: string[]) {
    const complete = vi.fn(async () => ({
      content: replies.shift() ?? '{}',
      model: 'deepseek-chat',
      usedFallback: false,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedTokens: 80,
    }));
    const builder = {
      listPages: vi.fn(async () => [{ slug: 'home', title: 'Home' }]),
      getPage: vi.fn(async () => ({ layout: page() })),
      createPage: vi.fn(async (_t: string, dto: { slug: string; title: string }) => ({ slug: dto.slug, title: dto.title })),
      savePage: vi.fn(async () => ({})),
    };
    const service = new BuilderAiService(
      { db: { query: { tenants: { findFirst: vi.fn(async () => ({ settings: {} })) } } } } as never,
      { complete, assertSafeUrl: vi.fn() } as never,
      { getRuntimeConfig: vi.fn(async () => runtime), getMaskedSettings: vi.fn() } as never,
      { configured: true, encrypt: vi.fn(), decrypt: vi.fn() } as never,
      builder as never,
    );
    return { service, complete, builder };
  }

  async function finish(service: BuilderAiService, id: string) {
    for (let i = 0; i < 100; i += 1) {
      const job = service.get('t', 'u', id);
      if (job.status !== 'running') return job;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('run did not finish');
  }

  const actor = { id: 'u', email: 'a@b.c' };

  it('applies an edit and reports usage', async () => {
    const { service } = makeService([
      JSON.stringify({ intent: 'edit', reply: 'Renamed the title.', operations: [{ op: 'update', id: 'h1', props: { text: 'Hello' } }] }),
    ]);
    const { id } = service.start('t', actor, { prompt: 'rename the title', pageSlug: 'home', layout: page() as never });
    const job = await finish(service, id);
    expect(job.status).toBe('done');
    expect(job.result?.changed).toBe(1);
    expect(JSON.stringify(job.result?.layout)).toContain('Hello');
    expect(job.result?.usage).toEqual({ calls: 1, inputTokens: 100, cachedTokens: 80, outputTokens: 50 });
  });

  it('builds planned sections in parallel and places them', async () => {
    const { service, complete } = makeService([
      JSON.stringify({ intent: 'build', reply: 'Added two sections.', placement: 'append', sections: [{ brief: 'A' }, { brief: 'B' }] }),
      JSON.stringify({ node: { type: 'section', content: [{ type: 'heading', text: 'Section A' }] } }),
      JSON.stringify({ node: { type: 'section', content: [{ type: 'heading', text: 'Section B' }] } }),
    ]);
    const { id } = service.start('t', actor, { prompt: 'add two sections', pageSlug: 'home', layout: page() as never });
    const job = await finish(service, id);
    expect(job.status).toBe('done');
    expect(complete).toHaveBeenCalledTimes(3);
    expect(job.result?.layout?.content).toHaveLength(3);
  });

  it('sends a section back with the validator\'s messages when it cannot be repaired locally', async () => {
    const { service, complete } = makeService([
      JSON.stringify({ intent: 'build', sections: [{ brief: 'A' }], placement: 'replace_page' }),
      'not json at all',
      JSON.stringify({ node: { type: 'section', content: [{ type: 'text', text: 'ok' }] } }),
    ]);
    const { id } = service.start('t', actor, { prompt: 'rebuild', pageSlug: 'home', layout: page() as never });
    const job = await finish(service, id);
    expect(job.status).toBe('done');
    expect(complete).toHaveBeenCalledTimes(3);
    expect(job.result?.layout?.content).toHaveLength(1);
  });

  // The model is not limited to the designed blocks: anything they cannot express becomes a new
  // element (its own tag, CSS, phone and hover rules, nested children). Unsafe values are dropped.
  it('creates a brand-new element the block list does not have', async () => {
    const table = {
      type: 'element',
      tag: 'table',
      css: 'width: 100%; border-collapse: collapse; background: url(javascript:alert(1)); color: rgb(var(--c-foreground))',
      cssMobile: 'font-size: 13px',
      content: [
        {
          type: 'element',
          tag: 'tr',
          content: [
            { type: 'element', tag: 'th', text: 'Plan', css: 'text-align: start; padding: 12px' },
            { type: 'element', tag: 'th', text: 'Seats', css: 'padding: 12px' },
          ],
        },
        {
          type: 'element',
          tag: 'tr',
          cssHover: 'background: rgb(var(--c-primary) / 0.08)',
          content: [
            { type: 'element', tag: 'td', text: 'Team', css: 'padding: 12px' },
            { type: 'element', tag: 'td', text: '10', css: 'padding: 12px' },
          ],
        },
      ],
    };
    const link = { type: 'element', tag: 'a', text: 'Compare plans', href: 'javascript:alert(1)' };
    const { service } = makeService([
      JSON.stringify({
        intent: 'edit',
        reply: 'Added a comparison table.',
        operations: [
          { op: 'insert', parent: 's1', slot: 'content', index: 2, node: table },
          { op: 'insert', parent: 's1', slot: 'content', index: 3, node: link },
        ],
      }),
    ]);
    const { id } = service.start('t', actor, { prompt: 'add a plan comparison table', pageSlug: 'home', layout: page() as never });
    const job = await finish(service, id);
    expect(job.status).toBe('done');
    const kids = (job.result?.layout as PageLayout).content[0]!.props!.content as Array<{ type: string; props: Record<string, unknown> }>;
    const added = kids[2]!;
    expect(added.type).toBe('element');
    expect(added.props.tag).toBe('table');
    // The theme colour survives; the javascript: background does not.
    expect(added.props.css).toContain('rgb(var(--c-foreground))');
    expect(String(added.props.css)).not.toContain('javascript');
    expect(added.props.cssMobile).toBe('font-size: 13px');
    const rows = added.props.content as Array<{ props: Record<string, unknown> }>;
    expect(rows).toHaveLength(2);
    expect(rows[1]!.props.cssHover).toContain('--c-primary');
    const cells = rows[0]!.props.content as Array<{ props: Record<string, unknown> }>;
    expect(cells.map((cell) => cell.props.text)).toEqual(['Plan', 'Seats']);
    // A link the model points at script is kept as text with no unsafe href.
    expect(String(kids[3]!.props.href ?? '')).not.toContain('javascript');
    expect(layoutIssues(job.result?.layout as PageLayout)).toEqual([]);
  });

  it('creates a new page as a draft', async () => {
    const { service, builder } = makeService([
      JSON.stringify({ intent: 'new_page', page: { slug: 'home', title: 'Showroom' }, sections: [{ brief: 'hero' }] }),
      JSON.stringify({ node: { type: 'section', content: [{ type: 'heading', text: 'Showroom', as: 'h1' }] } }),
    ]);
    const { id } = service.start('t', actor, { prompt: 'new showroom page' });
    const job = await finish(service, id);
    expect(job.status).toBe('done');
    // "home" is taken, so the next free slug is used.
    expect(job.result?.createdPage?.slug).toBe('home-2');
    expect(builder.savePage).toHaveBeenCalled();
  });

  it('only shows a run to the admin who started it', () => {
    const { service } = makeService(['{"intent":"answer","reply":"hi"}']);
    const { id } = service.start('t', actor, { prompt: 'hi' });
    expect(() => service.get('t', 'someone-else', id)).toThrow();
    expect(() => service.get('other-tenant', 'u', id)).toThrow();
  });

  it('rejects pictures that are not images', () => {
    const { service } = makeService([]);
    expect(() => service.start('t', actor, { prompt: 'copy', images: ['data:text/html;base64,AAAA'] })).toThrow(/PNG/);
  });
});
