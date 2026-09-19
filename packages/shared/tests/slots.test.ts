import { describe, expect, it } from 'vitest';
import { migrateLegacyLayout, getSlotChildren, getZoneItems } from '../src/blocks/slots';
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
