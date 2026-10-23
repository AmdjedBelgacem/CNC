import { describe, expect, it } from 'vitest';
import { collectPublishIssues } from '../src/utils/publish-rules';
import type { PageLayout } from '../src/types/page';

const page = {
  title: 'Home',
  slug: 'home',
  status: 'published',
  seoDescription: 'A real page',
};

const issuesFor = (layout: PageLayout) => collectPublishIssues(page, layout);

const text = (id: string, value = 'Body copy') => ({
  type: 'text',
  props: { id, text: value },
});

describe('publish checklist content warnings', () => {
  it('does not call a container empty when its slot children have copy', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'stack',
          props: { id: 'stack', content: [text('copy')] },
        },
      ],
    };
    const issues = issuesFor(layout);
    expect(issues.some((issue) => issue.id === 'noText')).toBe(false);
  });

  it('still warns about genuinely empty leaves', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        {
          type: 'stack',
          props: { id: 'stack', content: [text('blank', '')] },
        },
      ],
    };
    const issues = issuesFor(layout);
    const warning = issues.find((issue) => issue.id === 'noText');
    expect(warning?.values?.count).toBe(1);
  });

  it('treats an image or icon block as content', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        { type: 'image', props: { id: 'image', src: '/photo.jpg', alt: '' } },
        { type: 'icon', props: { id: 'icon', icon: 'verified' } },
      ],
    };
    expect(issuesFor(layout).some((issue) => issue.id === 'noText')).toBe(false);
  });

  it('keeps the hidden-block warning without counting hidden copies as empty', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [
        text('visible'),
        { type: 'badge', props: { id: 'hidden', text: '', visible: false } },
      ],
    };
    const issues = issuesFor(layout);
    expect(issues.find((issue) => issue.id === 'hidden')?.values?.count).toBe(1);
    expect(issues.some((issue) => issue.id === 'noText')).toBe(false);
  });

  it('still errors when every block is hidden', () => {
    const layout: PageLayout = {
      root: { props: {} },
      content: [{ type: 'heading', props: { id: 'hidden', text: 'Hi', visible: false } }],
    };
    const issues = issuesFor(layout);
    expect(issues.find((issue) => issue.id === 'allHidden')?.level).toBe('error');
  });
});
