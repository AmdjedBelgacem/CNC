import type { PuckNode } from '../types/page';
import { heroConsoleDefaults, type HeroConsoleProps } from './registry';

/**
 * Builds the composable console subtree from the legacy hero-console props.
 *
 * The original hero stored the whole simulator in one block. Old layouts are
 * expanded on read so the builder immediately exposes the frame, screen, image,
 * telemetry, axis drawer, mode bar and floating metric as separate nodes. The
 * generated ids are derived from the hero id, so repeated reads (and Arabic
 * structural alignment) keep the same addresses.
 */
function node(type: string, id: string, props: Record<string, unknown> = {}): PuckNode {
  return { type, props: { ...withoutUndefined(props), id } };
}

function withoutUndefined(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined));
}

export function consoleNodesFromProps(
  props: Partial<HeroConsoleProps> | Record<string, unknown>,
  baseId: string,
): PuckNode[] {
  const supplied = withoutUndefined(props as Record<string, unknown>);
  const consoleProps = { ...heroConsoleDefaults, ...supplied } as HeroConsoleProps;
  const id = (suffix: string) => `${baseId || 'hero-console'}__${suffix}`;

  const image = consoleProps.imageUrl
    ? node('console-image', id('console-image'), {
        src: consoleProps.imageUrl,
        alt: consoleProps.imageAlt,
      })
    : null;

  const telemetry = [
    consoleProps.feedValue
      ? node('console-telemetry', id('console-telemetry-feed'), {
          label: consoleProps.feedLabel,
          value: consoleProps.feedValue,
          tag: consoleProps.feedTag,
          tagTone: 'success',
        })
      : null,
    consoleProps.spindleValue
      ? node('console-telemetry', id('console-telemetry-spindle'), {
          label: consoleProps.spindleLabel,
          value: consoleProps.spindleValue,
          tag: consoleProps.spindleTag,
          tagTone: 'muted',
        })
      : null,
  ].filter((item): item is PuckNode => item !== null);

  const telemetryStack =
    telemetry.length > 0
      ? node('console-telemetry-stack', id('console-telemetry-stack'), {
          content: telemetry,
        })
      : null;

  const audit = consoleProps.auditValue
    ? node('console-audit', id('console-audit'), {
        title: consoleProps.auditTitle,
        value: consoleProps.auditValue,
        icon: 'verified_user',
      })
    : null;

  const axisItems = (consoleProps.axes ?? []).map((axis, index) =>
    node('console-axis', id(`console-axis-${index}`), {
      label: axis.label,
      value: axis.value,
      tone: axis.tone,
    }),
  );
  const axisDrawer =
    axisItems.length > 0
      ? node('console-axis-drawer', id('console-axis-drawer'), {
          title: consoleProps.axesTitle,
          vibration: consoleProps.vibration,
          content: axisItems,
        })
      : null;

  const modeItems = (consoleProps.modes ?? []).map((mode, index) =>
    node('console-mode', id(`console-mode-${index}`), {
      label: mode.label,
      active: index === 0,
      hideOnMobile: index >= 2,
    }),
  );
  const modeBar =
    modeItems.length > 0
      ? node('console-mode-bar', id('console-mode-bar'), {
          controllerLabel: consoleProps.controllerLabel,
          content: modeItems,
        })
      : null;

  const metric = consoleProps.floatValue
    ? node('console-metric', id('console-metric'), {
        icon: consoleProps.floatIcon,
        label: consoleProps.floatLabel,
        value: consoleProps.floatValue,
        tag: consoleProps.floatTag,
      })
    : null;

  const overlays = [telemetryStack, audit, axisDrawer].filter(
    (item): item is PuckNode => item !== null,
  );
  const screenProps: Record<string, unknown> = {};
  if (image) screenProps.media = [image];
  if (overlays.length > 0) screenProps.overlays = overlays;

  const screen = node('console-screen', id('console-screen'), screenProps);
  const header = node('console-header', id('console-header'), {
    fileName: consoleProps.fileName,
    syncLabel: consoleProps.syncLabel,
  });

  const frameChildren = [header, screen, modeBar, metric].filter(
    (item): item is PuckNode => item !== null,
  );

  return [
    node('console-frame', id('console-frame'), {
      content: frameChildren,
    }),
  ];
}
