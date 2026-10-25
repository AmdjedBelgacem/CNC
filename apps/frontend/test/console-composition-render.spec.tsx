import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import {
  consoleAxisDefaults,
  consoleFrameDefaults,
  consoleImageDefaults,
  consoleMetricDefaults,
  consoleScreenDefaults,
  consoleTelemetryDefaults,
  heroConsoleDefaults,
} from '@titan/shared';
import type { PuckNode } from '@titan/shared';
import { HeroConsoleBlock } from '../src/components/builder/blocks/hero-console-block';
import { ConsoleFrameBlock } from '../src/components/builder/blocks/console-frame-block';
import { ConsoleScreenBlock } from '../src/components/builder/blocks/console-screen-block';
import { ConsoleImageBlock } from '../src/components/builder/blocks/console-image-block';
import { ConsoleTelemetryStackBlock } from '../src/components/builder/blocks/console-telemetry-stack-block';
import { ConsoleTelemetryBlock } from '../src/components/builder/blocks/console-telemetry-block';
import { ConsoleAxisDrawerBlock } from '../src/components/builder/blocks/console-axis-drawer-block';
import { ConsoleAxisBlock } from '../src/components/builder/blocks/console-axis-block';
import { ConsoleMetricBlock } from '../src/components/builder/blocks/console-metric-block';
import type { PuckBridge } from '../src/components/builder/blocks';
import { BuilderNode } from '../src/components/builder/block-renderer';
import { seedHeroConsole } from '@titan/shared';

function bridge(renderSlot: PuckBridge['renderSlot'], children: PuckNode[] = []): PuckBridge {
  return {
    renderSlot,
    getSlotData: () => children,
    isEditing: false,
  } as PuckBridge;
}

function slot(label: string): ReactNode {
  return <div data-slot={label} />;
}

describe('composable console rendering', () => {
  it('renders the seeded console tree through the public slot renderer', () => {
    const seed = seedHeroConsole({ imageUrl: '/seeded-console.png' });
    const markup = renderToStaticMarkup(<BuilderNode node={seed.node} />);
    expect(markup).toContain('src="/seeded-console.png"');
    expect(markup).toContain('KINEMATIC AXES [RTCP ACTIVE]');
    expect(markup).toContain('Cycle Time Reduction');
    expect(markup).toContain('Iso View');
    expect(markup).toContain('SIM_CELL_DMG_DUOBODY_5X.cnc');
  });

  it('renders the legacy console when auto has no composed children', () => {
    const markup = renderToStaticMarkup(
      <HeroConsoleBlock
        props={{ ...heroConsoleDefaults, id: 'hero', consoleMode: 'auto' }}
        puck={bridge((name) => (name === 'content' ? slot('content') : slot(name)))}
      />,
    );
    expect(markup).toContain('SIM_CELL_5X.cnc');
    expect(markup).not.toContain('data-slot="console"');
  });

  it('renders the component tree when the console slot has children', () => {
    const markup = renderToStaticMarkup(
      <HeroConsoleBlock
        props={{ ...heroConsoleDefaults, id: 'hero', consoleMode: 'auto' }}
        puck={bridge(
          (name) => (name === 'content' ? slot('content') : slot(name)),
          [{ type: 'console-frame', props: { id: 'frame' } }],
        )}
      />,
    );
    expect(markup).toContain('data-slot="console"');
    expect(markup).not.toContain('SIM_CELL_5X.cnc');
  });

  it('keeps the legacy console when the author explicitly chooses it', () => {
    const markup = renderToStaticMarkup(
      <HeroConsoleBlock
        props={{ ...heroConsoleDefaults, id: 'hero', consoleMode: 'legacy' }}
        puck={bridge((name) => slot(name), [{ type: 'console-frame', props: { id: 'frame' } }])}
      />,
    );
    expect(markup).toContain('SIM_CELL_5X.cnc');
    expect(markup).not.toContain('data-slot="console"');
  });

  it('renders the frame, screen, image, telemetry, axis and metric blocks independently', () => {
    let frameSlotClass = '';
    const frame = renderToStaticMarkup(
      <ConsoleFrameBlock
        props={{ ...consoleFrameDefaults, id: 'frame', padding: 12 }}
        puck={bridge((_name, options) => {
          frameSlotClass = options?.className ?? '';
          return slot('frame-content');
        })}
      />,
    );
    expect(frame).toContain('dir="ltr"');
    expect(frame).toContain('padding:12px');
    expect(frame).toContain('data-slot="frame-content"');
    expect(frameSlotClass).toContain('[&>div]:!static');

    let mediaSlotClass = '';
    let overlaysSlotClass = '';
    const screen = renderToStaticMarkup(
      <ConsoleScreenBlock
        props={{
          ...consoleScreenDefaults,
          id: 'screen',
          height: 520,
          mobileHeight: 400,
          blueprint: false,
        }}
        puck={bridge((name, options) => {
          if (name === 'media') mediaSlotClass = options?.className ?? '';
          if (name === 'overlays') overlaysSlotClass = options?.className ?? '';
          return slot(`screen-${name}`);
        })}
      />,
    );
    expect(screen).toContain('--console-screen-height:520px');
    expect(screen).toContain('--console-screen-height-mobile:400px');
    expect(screen).not.toContain('blueprint-grid');
    expect(screen).toContain('data-slot="screen-media"');
    expect(mediaSlotClass).toContain('absolute inset-0 z-0');
    expect(mediaSlotClass).toContain('[&>div]:!static');
    expect(overlaysSlotClass).toContain('[&>div]:!static');

    const image = renderToStaticMarkup(
      <ConsoleImageBlock
        props={{ ...consoleImageDefaults, id: 'image', src: '/sim.png', alt: 'Simulation' }}
        puck={bridge(() => null)}
      />,
    );
    expect(image).toContain('src="/sim.png"');
    expect(image).toContain('alt="Simulation"');
    expect(image).toContain('!pointer-events-auto');

    const telemetry = renderToStaticMarkup(
      <ConsoleTelemetryBlock
        props={{ ...consoleTelemetryDefaults, id: 'telemetry', value: '9,999 mm/min' }}
        puck={bridge(() => null)}
      />,
    );
    expect(telemetry).toContain('FEED:');
    expect(telemetry).toContain('9,999 mm/min');

    const axis = renderToStaticMarkup(
      <ConsoleAxisBlock
        props={{
          ...consoleAxisDefaults,
          id: 'axis',
          label: 'B-TILT',
          value: '-22.45°',
          tone: 'accent',
        }}
        puck={bridge(() => null)}
      />,
    );
    expect(axis).toContain('B-TILT');
    expect(axis).toContain('-22.45°');

    const metric = renderToStaticMarkup(
      <ConsoleMetricBlock
        props={{ ...consoleMetricDefaults, id: 'metric', value: '-40.1%' }}
        puck={bridge(() => null)}
      />,
    );
    expect(metric).toContain('-40.1%');
    expect(metric).toContain('top-full');
    expect(metric).toContain('mt-4');
    expect(metric).toContain('!pointer-events-auto');
  });

  it('passes layout classes to the editor slot wrapper so axis and telemetry children lay out correctly', () => {
    let axisSlotClass = '';
    const drawer = renderToStaticMarkup(
      <ConsoleAxisDrawerBlock
        props={{ ...consoleAxisDefaults, id: 'drawer' } as never}
        puck={bridge(
          (_name, options) => {
            axisSlotClass = options?.className ?? '';
            return slot('axis-children');
          },
          [{ type: 'console-axis', props: { id: 'a' } }],
        )}
      />,
    );
    expect(drawer).toContain('data-slot="axis-children"');
    // Mobile: `contents` lets the axis cells join the drawer's 3-column grid. Desktop:
    // the wrapper becomes the original single flex row.
    expect(axisSlotClass).toContain('contents');
    expect(axisSlotClass).toContain('sm:flex sm:flex-1 sm:gap-2');
    expect(drawer).toContain('!pointer-events-auto');

    let telemetrySlotClass = '';
    renderToStaticMarkup(
      <ConsoleTelemetryStackBlock
        props={{ id: 'stack', placement: 'bottom-right', gap: 'lg' }}
        puck={bridge((_name, options) => {
          telemetrySlotClass = options?.className ?? '';
          return slot('telemetry-children');
        })}
      />,
    );
    expect(telemetrySlotClass).toContain('flex flex-col');
    expect(telemetrySlotClass).toContain('gap-3');
  });
});
