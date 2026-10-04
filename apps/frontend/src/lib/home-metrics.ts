import type { PageLayout, PuckNode, StatCardInput } from '@titan/shared';
import { seedStatCard } from '@titan/shared';

export interface LiveHomeMetrics {
  trustCount: string;
  trustNote: string;
  ctaSubtitle: string;
  ctaPill?: string;
  stats: StatCardInput[];
}

export function buildLiveHomeMetrics(input: {
  academyCount: number;
  courseCount: number;
  sponsorCount: number;
}): LiveHomeMetrics {
  const { academyCount, courseCount, sponsorCount } = input;
  return {
    trustCount: `+${academyCount}`,
    trustNote: `${academyCount} specialized academies and ${courseCount} published courses — free core curriculum for modern machinists.`,
    ctaSubtitle: `Join learners across ${academyCount} academies and ${courseCount} courses. Secure your place in the next self-paced cohort.`,
    ctaPill: 'Enrollments Open',
    stats: [
      {
        label: 'Catalog',
        tag: 'Live',
        tagIcon: 'school',
        value: String(academyCount),
        sub: 'Published Academies',
        note: 'Structured paths through the skills shops hire for.',
      },
      {
        label: 'Curriculum',
        tag: 'Free core',
        tagIcon: 'menu_book',
        tagVariant: 'primary',
        value: String(courseCount),
        sub: 'Published Courses',
        note: 'Hands-on projects with simulators — no paywalls on core tracks.',
      },
      {
        label: 'Network',
        tag: 'Industry',
        tagIcon: 'handshake',
        value: String(sponsorCount),
        sub: 'OEM & Software Partners',
        note: 'Machine tool and CAM partners represented in the catalog.',
      },
      {
        label: 'Access',
        tag: 'Self-paced',
        tagIcon: 'language',
        tagVariant: 'primary',
        value: '$0',
        sub: 'Browser-native Format',
        note: 'Learn from anywhere with cloud CAM and digital twin tools.',
      },
    ],
  };
}

function isNodeArray(value: unknown): value is PuckNode[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PuckNode).type === 'string',
    )
  );
}

/**
 * Server-side: rewrite seed marketing metrics in the layout tree so SSR HTML
 * and client hydration see identical text (no client-side rewrites needed).
 */
export function applyLiveHomeMetrics(layout: PageLayout, metrics: LiveHomeMetrics): PageLayout {
  const walkNodes = (nodes: PuckNode[]): PuckNode[] =>
    nodes.map((node) => {
      const props = { ...(node.props ?? {}) };
      if (node.type === 'avatar-stack') {
        const count = props.count;
        if (count === '+17k' || count === '+80') props.count = metrics.trustCount;
      }
      if (node.type === 'text' && typeof props.text === 'string' && props.text.includes('17,400')) {
        props.text = metrics.trustNote;
      }
      if (node.type === 'cta-signup') {
        if (typeof props.pill === 'string' && props.pill.includes('Cohort')) {
          props.pill = metrics.ctaPill ?? props.pill;
        }
        props.subtitle = metrics.ctaSubtitle;
      }
      if (node.type === 'stats') {
        // Same seedStatCard shape the editor uses — client never rebuilds this.
        props.content = metrics.stats.map((stat) => seedStatCard(stat).node);
      } else {
        for (const [key, value] of Object.entries(props)) {
          if (isNodeArray(value)) props[key] = walkNodes(value);
        }
      }
      return { type: node.type, props };
    });

  const zones = layout.zones
    ? Object.fromEntries(
        Object.entries(layout.zones).map(([key, nodes]) => [key, walkNodes(nodes)]),
      )
    : undefined;

  return {
    ...layout,
    content: walkNodes(layout.content ?? []),
    ...(zones ? { zones } : {}),
  };
}
