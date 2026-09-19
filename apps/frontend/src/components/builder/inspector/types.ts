import type { LucideIcon } from 'lucide-react';

/**
 * Inspector field definitions — the frontend editing surface for the Puck
 * builder. The shared block registry stays the source of truth for prop
 * names, value universes, defaults and validation;
 * `defineInspector<TProps>()` guarantees every `key` below is a real prop of the block's schema type.
 */
export type ControlKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'segmented'
  | 'slider'
  | 'toggle'
  | 'color'
  | 'icon';

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface InspectorFieldDef<TProps = Record<string, unknown>> {
  /** Prop name on the block's schema (compile-checked). */
  key: keyof TProps & string;
  label: string;
  control: ControlKind;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  /** Hide the field unless the current props satisfy this. */
  showWhen?: (props: TProps) => boolean;
  /** "Reset" target when it differs from the registry defaultProps. */
  resetValue?: unknown;
}

export interface InspectorGroup<TProps = Record<string, unknown>> {
  id: string;
  title: string;
  icon?: LucideIcon;
  fields: InspectorFieldDef<TProps>[];
}

export interface InspectorBlockDef {
  label: string;
  /** Loosely-typed so heterogeneous inspectors can be collected in one registry. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groups: InspectorGroup<any>[];
}

/** Compile-time checked group builder. */
export function defineInspector<TProps>(): {
  groups: (groups: InspectorGroup<TProps>[]) => Pick<InspectorBlockDef, 'groups'>;
} {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groups: (groups) => ({
      groups: groups as InspectorGroup<any>[],
    }),
  };
}

/** Shared spacing/sizing row reused by every block. */
export const LAYOUT_FIELDS: InspectorFieldDef<{
  marginTop?: number;
  marginBottom?: number;
  maxWidth?: number;
  minHeight?: number;
}>[] = [
  { key: 'marginTop', label: 'Margin top', control: 'slider', min: 0, max: 320, step: 4 },
  { key: 'marginBottom', label: 'Margin bottom', control: 'slider', min: 0, max: 320, step: 4 },
  { key: 'maxWidth', label: 'Max width', control: 'slider', min: 0, max: 2560, step: 16 },
  { key: 'minHeight', label: 'Min height', control: 'slider', min: 0, max: 3000, step: 16 },
];

export const PADDING_FIELDS: InspectorFieldDef<{
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}>[] = [
  { key: 'paddingTop', label: 'Padding top', control: 'slider', min: 0, max: 320, step: 4 },
  { key: 'paddingRight', label: 'Padding right', control: 'slider', min: 0, max: 320, step: 4 },
  { key: 'paddingBottom', label: 'Padding bottom', control: 'slider', min: 0, max: 320, step: 4 },
  { key: 'paddingLeft', label: 'Padding left', control: 'slider', min: 0, max: 320, step: 4 },
];
