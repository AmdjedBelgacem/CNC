import { describe, expect, it } from 'vitest';
import {
  migrateLegacyLayout,
  getSlotChildren,
  getZoneItems,
  mergeLayoutStructure,
  ensureNodeIds,
} from '../src/blocks/slots';
import { validatePageLayout, validateLayoutZones } from '../src/validators/page';
import type { PageLayout } from '../src/types/page';

function legacyLayout(): PageLayout {
  return {
    root: { props: {} },
    content: [{ type: 'hero', props: { id: 'hero-1' } }],
    zones: {
      'hero-1:content': [
        { type: 'heading', props: { id: 'h-1', text: 'Hi' } },
        { type: 'button', props: { id: 'b-1', label: 'Go' } },
      ],
    },
  };
}

describe('migrateLegacyLayout', () => {
  it('moves flat zones into inline slot props', () => {
    const out = migrateLegacyLayout(legacyLayout());
    expect(out.zones).toBeUndefined();
    expect(getSlotChildren(out.content[0], 'content').map((n) => n.type)).toEqual([
      'heading',
      'button',
    ]);
  });

  it('leaves unknown/orphan entries untouched', () => {
    const layout = legacyLayout();
    layout.zones!['ghost:content'] = [{ type: 'text', props: { id: 't-9' } }];
    const out = migrateLegacyLayout(layout);
    expect(out.zones).toEqual({ 'ghost:content': [{ type: 'text', props: { id: 't-9' } }] });
    // ...while still migrating the known entry
    expect(getSlotChildren(out.content[0], 'content')).toHaveLength(2);
  });

  it('returns the same reference when there is nothing to migrate', () => {
    const inline: PageLayout = {
      root: { props: {} },
      content: [{ type: 'hero', props: { id: 'h', content: [{ type: 'text', props: { id: 't' } }] } }],
    };
    expect(migrateLegacyLayout(inline)).toBe(inline);
  });

  it('migrated layouts validate', () => {
    expect(validatePageLayout(migrateLegacyLayout(legacyLayout())).ok).toBe(true);
  });

  it('getZoneItems resolves root, inline and legacy zones', () => {
    const migrated = migrateLegacyLayout(legacyLayout());
    expect(getZoneItems(migrated, 'root:default-zone')).toHaveLength(1);
    expect(getZoneItems(migrated, 'hero-1:content')).toHaveLength(2);
    expect(getZoneItems(legacyLayout(), 'hero-1:content')).toHaveLength(2);
    expect(getZoneItems(migrated, 'nope:content')).toEqual([]);
  });
});

describe('ensureNodeIds', () => {
  it('gives every node a stable id without disturbing existing ids', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'section',
          props: {
            content: [
              {
                type: 'stack',
                props: {
                  content: [
                    { type: 'heading', props: { text: 'Our Machines' } },
                    { type: 'text', props: { id: 'keep-me', text: 'A paragraph' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    const out = ensureNodeIds(layout);
    const section = out.content[0]!;
    const stack = getSlotChildren(section, 'content')[0]!;
    const [heading, text] = getSlotChildren(stack, 'content');
    expect(section.props?.id).toMatch(/^auto-/);
    expect(stack.props?.id).toMatch(/^auto-/);
    expect(heading?.props?.id).toMatch(/^auto-/);
    expect(text?.props?.id).toBe('keep-me');
  });

  it('is idempotent and returns the same reference when every node has an id', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [{ type: 'heading', props: { id: 'heading-1', text: 'Hello' } }],
    };
    expect(ensureNodeIds(layout)).toBe(layout);
  });

  it('leaves the generated tree stable across a second pass', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        { type: 'section', props: { content: [{ type: 'heading', props: { text: 'Hello' } }] } },
      ],
    };
    const once = ensureNodeIds(layout);
    const twice = ensureNodeIds(once);
    expect(twice).toBe(once);
  });
});

describe('mergeLayoutStructure', () => {
  const english: PageLayout = {
    root: { props: {} },
    content: [
      {
        type: 'section',
        props: {
          id: 'section-a',
          visible: true,
          content: [
            { type: 'heading', props: { id: 'heading-a', text: 'English heading' } },
            { type: 'text', props: { id: 'text-new', text: 'New paragraph' } },
          ],
        },
      },
      { type: 'heading', props: { id: 'heading-b', text: 'Second section' } },
    ],
  };

  const arabic: PageLayout = {
    root: { props: {} },
    content: [
      {
        type: 'section',
        props: {
          id: 'section-a',
          visible: false,
          content: [{ type: 'heading', props: { id: 'heading-a', text: 'عنوان عربي' } }],
        },
      },
    ],
  };

  it('keeps Arabic copy on existing ids and pulls in newly added English nodes', () => {
    const merged = mergeLayoutStructure(english, arabic);
    const section = merged.content[0]!;
    const heading = getSlotChildren(section, 'content')[0]!;
    expect(heading.props?.text).toBe('عنوان عربي');
    expect(getSlotChildren(section, 'content').map((n) => n.props?.id)).toEqual([
      'heading-a',
      'text-new',
    ]);
    // A block added to English after the translation existed is present.
    expect(merged.content[1]?.props?.text).toBe('Second section');
  });

  it('takes visibility from English rather than a stale translated tree', () => {
    const merged = mergeLayoutStructure(english, arabic);
    expect(merged.content[0]?.props?.visible).toBe(true);
  });

  it('falls back to the English node when the translated block was replaced', () => {
    const replaced = structuredClone(arabic);
    replaced.content[0]!.type = 'stats';
    const merged = mergeLayoutStructure(english, replaced);
    expect(merged.content[0]?.type).toBe('section');
    expect(merged.content[0]?.props?.visible).toBe(true);
  });

  it('copies English presentation props onto the translated tree but keeps its copy', () => {
    const english: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero',
          props: {
            id: 'hero-visual',
            backgroundOverlay: 35,
            imageUrl: '/new-hero.jpg',
            content: [{ type: 'heading', props: { id: 'hero-heading', text: 'New English' } }],
          },
        },
      ],
    };
    const translated: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero',
          props: {
            id: 'hero-visual',
            backgroundOverlay: 80,
            imageUrl: '/old-hero.jpg',
            content: [{ type: 'heading', props: { id: 'hero-heading', text: 'عنوان عربي' } }],
          },
        },
      ],
    };

    const merged = mergeLayoutStructure(english, translated);
    const hero = merged.content[0]!;
    expect(hero.props?.backgroundOverlay).toBe(35);
    expect(hero.props?.imageUrl).toBe('/new-hero.jpg');
    expect(getSlotChildren(hero, 'content')[0]?.props?.text).toBe('عنوان عربي');
  });

  it('keeps short translated labels that are copy rather than presentation', () => {
    const english: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: {
            id: 'console-copy',
            consoleMode: 'composed',
            console: [
              {
                type: 'console-frame',
                props: {
                  id: 'console-copy__frame',
                  content: [
                    {
                      type: 'console-telemetry',
                      props: { id: 'console-copy__feed', tag: 'G01 SMOOTH', tagTone: 'success' },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const translated: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'hero-console',
          props: {
            id: 'console-copy',
            consoleMode: 'composed',
            console: [
              {
                type: 'console-frame',
                props: {
                  id: 'console-copy__frame',
                  content: [
                    {
                      type: 'console-telemetry',
                      props: { id: 'console-copy__feed', tag: 'ناعم', tagTone: 'normal' },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    const merged = mergeLayoutStructure(english, translated);
    const frame = getSlotChildren(merged.content[0]!, 'console')[0]!;
    const telemetry = getSlotChildren(frame, 'content')[0]!;
    expect(telemetry.props?.tag).toBe('ناعم');
    expect(telemetry.props?.tagTone).toBe('success');
  });
});

describe('validateLayoutZones with slots', () => {
  it('flags disallowed inline children', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'stats',
          props: { id: 's', content: [{ type: 'heading', props: { id: 'h' } }] },
        },
      ],
    };
    const violations = validateLayoutZones(layout);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('does not allow');
    expect(validatePageLayout(layout).ok).toBe(false);
  });

  it('still flags legacy zones entries', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [{ type: 'stats', props: { id: 's' } }],
      zones: { 's:content': [{ type: 'heading', props: { id: 'h' } }] },
    };
    expect(validateLayoutZones(layout)).toHaveLength(1);
  });
});
