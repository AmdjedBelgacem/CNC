import { describe, expect, it } from 'vitest';
import type { PageLayout, PuckNode } from '../src/types/page';
import { getSlotChildren, mergeLayoutStructure } from '../src/blocks/slots';
import { expandHeroConsoleLayout } from '../src/blocks/slots';
import { seedHeroConsole } from '../src/blocks/seeds';
import { heroConsoleDefaults } from '../src/blocks/registry';
import { validatePageLayout } from '../src/validators/page';

function layoutOf(node: PuckNode): PageLayout {
  return { root: { props: {} }, content: [node] };
}

function slot(node: PuckNode, name: string): PuckNode[] {
  return getSlotChildren(node, name);
}

function findById(nodes: PuckNode[], id: string): PuckNode | undefined {
  for (const node of nodes) {
    if (node.props?.id === id) return node;
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (
        Array.isArray(value) &&
        value.every((item) => item && typeof item === 'object' && 'type' in item)
      ) {
        const found = findById(value as PuckNode[], id);
        if (found) return found;
      }
    }
  }
  return undefined;
}

describe('composable console', () => {
  it('seedHeroConsole ships the console as independently editable nodes', () => {
    const seed = seedHeroConsole({ imageUrl: '/hero-console.png' });
    const hero = seed.node;
    expect(hero.props?.consoleMode).toBe('composed');

    const [frame] = slot(hero, 'console');
    expect(frame?.type).toBe('console-frame');
    expect(slot(frame, 'content').map((node) => node.type)).toEqual([
      'console-header',
      'console-screen',
      'console-mode-bar',
      'console-metric',
    ]);

    const screen = slot(frame, 'content')[1];
    const [image] = slot(screen, 'media');
    expect(image?.type).toBe('console-image');
    expect(image?.props).toMatchObject({ src: '/hero-console.png' });

    const overlays = slot(screen, 'overlays');
    expect(overlays.map((node) => node.type)).toEqual([
      'console-telemetry-stack',
      'console-audit',
      'console-axis-drawer',
    ]);
    expect(slot(overlays[0], 'content').map((node) => node.type)).toEqual([
      'console-telemetry',
      'console-telemetry',
    ]);
    expect(slot(overlays[2], 'content')).toHaveLength(5);
    expect(slot(slot(frame, 'content')[2], 'content')).toHaveLength(3);

    const validation = validatePageLayout(layoutOf(hero));
    expect(validation.ok).toBe(true);
  });

  it('expands a legacy hero-console once and keeps the generated ids stable', () => {
    const legacy: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: {
            ...heroConsoleDefaults,
            id: 'hero-home',
            imageUrl: '/legacy.png',
            feedLabel: 'FEED',
            axes: [{ label: 'X', value: '1.0' }],
            modes: [{ label: 'Iso View' }],
          },
        },
      ],
    };

    const expanded = expandHeroConsoleLayout(legacy);
    const hero = expanded.content[0];
    expect(hero.props?.consoleMode).toBe('composed');
    const [frame] = slot(hero, 'console');
    expect(frame.props?.id).toBe('hero-home__console-frame');
    expect(slot(screenOf(frame), 'media')[0].props?.id).toBe('hero-home__console-image');

    const again = expandHeroConsoleLayout(expanded);
    expect(again).toEqual(expanded);
  });

  it('respects an explicit legacy choice and an empty composed slot', () => {
    const legacyChoice: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: { ...heroConsoleDefaults, id: 'h1', consoleMode: 'legacy' },
        },
      ],
    };
    expect(expandHeroConsoleLayout(legacyChoice)).toEqual(legacyChoice);

    const emptyComposed: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: { ...heroConsoleDefaults, id: 'h2', consoleMode: 'composed', console: [] },
        },
      ],
    };
    const expanded = expandHeroConsoleLayout(emptyComposed);
    expect(slot(expanded.content[0], 'console')).toEqual([]);
  });

  it('merges translated console copy onto the English structure', () => {
    const english = expandHeroConsoleLayout({
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: { ...heroConsoleDefaults, id: 'hero-ar', imageUrl: '/img.png' },
        },
      ],
    });
    const translated = expandHeroConsoleLayout({
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: {
            ...heroConsoleDefaults,
            id: 'hero-ar',
            imageUrl: '/img.png',
            feedLabel: 'التغذية:',
            feedTag: 'ناعم',
            auditTitle: 'تدقيق التصادم',
            axesTitle: 'المحاور الحركية',
            modes: [{ label: 'عرض متساوي القياس' }],
          },
        },
      ],
    });

    const merged = mergeLayoutStructure(english, translated);
    const frame = findById(merged.content, 'hero-ar__console-frame');
    expect(frame).toBeDefined();
    const feed = findById(merged.content, 'hero-ar__console-telemetry-feed');
    expect(feed?.props).toMatchObject({ label: 'التغذية:', tag: 'ناعم' });
    const audit = findById(merged.content, 'hero-ar__console-audit');
    expect(audit?.props).toMatchObject({ title: 'تدقيق التصادم' });
    const axisDrawer = findById(merged.content, 'hero-ar__console-axis-drawer');
    expect(axisDrawer?.props).toMatchObject({ title: 'المحاور الحركية' });
    const mode = findById(merged.content, 'hero-ar__console-mode-0');
    expect(mode?.props).toMatchObject({ label: 'عرض متساوي القياس' });
  });
});

function screenOf(frame: PuckNode): PuckNode {
  return slot(frame, 'content').find((node) => node.type === 'console-screen') as PuckNode;
}
