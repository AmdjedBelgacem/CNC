import { describe, expect, it } from 'vitest';
import { seedHomeLayout, type PuckNode } from '@titan/shared';
import { applyLiveHomeMetrics, buildLiveHomeMetrics, isZeroCountToken } from '../src/lib/home-metrics';

const all = (nodes: PuckNode[]): PuckNode[] =>
  nodes.flatMap((node) => [
    node,
    ...Object.values(node.props ?? {}).flatMap((value) =>
      Array.isArray(value) && value.every((v) => v && typeof v === 'object' && 'type' in v) ? all(value as PuckNode[]) : [],
    ),
  ]);

describe('homepage counts of zero', () => {
  it('recognises a bare placeholder whose count is 0', () => {
    expect(isZeroCountToken('{{courses}}', { courses: '0' })).toBe(true);
    expect(isZeroCountToken('{{courses}}', { courses: '4' })).toBe(false);
    expect(isZeroCountToken('Join {{courses}} courses', { courses: '0' })).toBe(false);
  });

  it('marks zero stats so the page hides them and keeps the others', () => {
    const layout = applyLiveHomeMetrics(
      seedHomeLayout(),
      buildLiveHomeMetrics({ academyCount: 0, courseCount: 0, sponsorCount: 0, productCount: 6, locale: 'en' }),
    );
    const values = all(layout.content ?? []).filter(
      (n) => n.type === 'element' && ['0', '6'].includes(String(n.props?.text)),
    );
    expect(values.filter((n) => n.props?.countZero === true)).toHaveLength(2);
    expect(values.find((n) => n.props?.text === '6')?.props?.countZero).toBeUndefined();
  });
});
