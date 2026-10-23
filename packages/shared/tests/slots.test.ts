import { describe, expect, it } from 'vitest';
import {
  migrateLegacyLayout,
  getSlotChildren,
  getZoneItems,
  mergeLayoutStructure,
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
