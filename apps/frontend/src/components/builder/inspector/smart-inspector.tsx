'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { getBlockDefinition } from '@titan/shared';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck';
import {
  ChevronDown,
  ChevronUp,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring, transition } from '@/lib/motion';
import { JsonInspectorSection } from '../node-inspector';
import { BLOCK_INSPECTOR, animationInspectorGroup } from './fields';
import { useAnimPlayback } from '@/components/builder/animation';
import { DynamicContentNotice } from './dynamic-content-notice';
import { BlockTranslationFields } from './block-translation-fields';
import type { InspectorGroup, InspectorFieldDef } from './types';
import {
  useInspectorText,
  ColorControl,
  FieldRow,
  IconControl,
  NumberControl,
  SegmentedControl,
  SelectControl,
  SliderControl,
  TextControl,
  TextareaControl,
  ToggleControl,
} from './controls';
import { ImageUploadControl } from './image-upload-control';
const ROOT_DROPPABLE_ID = 'root:default-zone'; /** The selected node's live props. */
type SelectedNode = {
  type: string;
  props: { id: string } & Record<string, unknown>;
}; /** * Smart Contextual Inspector — adaptive, grouped property panels. * * Replaces Puck's default field form entirely while a node is selected. * Changes are applied through the same `replace` dispatch Puck itself uses * (`createOnChange`), so history, undo, and iframe updates all behave * identically to stock behaviour. */
export function SmartInspector() {
  // Every hook runs before any early return. This one used to sit below the two
  // `if (!selected) return` / `if (!def) return` branches, so selecting a block
  // added a hook and deselecting removed one — a rules-of-hooks violation, and on
  // the short-circuit path the intl provider was never reached.
  const groupText = useInspectorText();
  const t = useTranslations('ui.builder');
  const selected = useBuilderPuck((s) => s.selectedItem) as unknown as SelectedNode | null;
  const getSelectorForId = useBuilderPuck((s) => s.getSelectorForId);
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const def = useMemo(
    () => (selected ? BLOCK_INSPECTOR[selected.type] : undefined),
    [selected?.type],
  );
  const defaults = useMemo(
    () => (selected ? (getBlockDefinition(selected.type)?.defaultProps ?? {}) : {}),
    [selected?.type],
  );
  if (!selected) return <EmptyInspectorState />;
  const updateProp = (key: string, value: unknown) => {
    const id = selected.props.id as string | undefined;
    if (!id) return;
    const selector = getSelectorForId(id);
    if (!selector) return;
    const newProps = { ...selected.props, [key]: value };
    dispatch({
      type: 'replace',
      destinationIndex: selector.index,
      destinationZone: selector.zone || ROOT_DROPPABLE_ID,
      data: { ...selected, props: newProps },
    });
  }; // Selected block without an inspector definition (chrome blocks etc.) gets a // lightweight fallback panel so the sidebar never looks broken.
  if (!def) {
    return (
      <m.div
        key={selected.props.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {' '}
        <InspectorHeader type={selected.type} label={selected.type} />{' '}
        <DynamicContentNotice type={selected.type} props={selected.props} />{' '}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          {' '}
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-surface-sunken text-muted-foreground">
            {' '}
            <Settings2 className="size-4" />{' '}
          </span>{' '}
          <p className="font-display text-base font-medium tracking-[-0.01em] text-foreground">{t('noProperties')}</p>{' '}
          <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
            {' '}
            {t('noPropertiesHint')}{' '}
          </p>{' '}
        </div>{' '}
        <JsonInspectorSection />{' '}
      </m.div>
    );
  }
  return (
    <m.div
      key={selected.props.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: transition.enter }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {' '}
      <InspectorHeader
        type={selected.type}
        label={groupText.label(undefined, def.label ?? selected.type)}
      />{' '}
      <DynamicContentNotice type={selected.type} props={selected.props} />{' '}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {' '}
        <AnimationTransport nodeId={String(selected.props.id ?? '')} animType={selected.props.animType} />{' '}
      {[...def.groups, animationInspectorGroup].map((group) => (
          <InspectorGroupSection
            key={group.id}
            group={group as InspectorGroup<Record<string, unknown>>}
            props={selected.props}
            defaults={defaults}
            onUpdate={updateProp}
          />
        ))}{' '}
        <BlockTranslationFields selected={selected} />
      </div>{' '}
      <JsonInspectorSection />{' '}
    </m.div>
  );
} /** Rendered in the sidebar when nothing is selected yet. */
export function EmptyInspectorState() {
  const t = useTranslations('ui.builder');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {' '}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3.5">
        {' '}
        <Settings2 className="size-3.5 text-muted-foreground" />{' '}
        <span className="font-display text-sm font-medium tracking-[-0.01em] text-foreground">
          {t('inspector')}
        </span>{' '}
      </div>{' '}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: transition.reveal }}
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
      >
        <m.span
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <MousePointerClick className="size-5" />
        </m.span>
        <p className="text-balance font-display text-lg font-medium tracking-[-0.015em] text-foreground">{t('selectComponent')}</p>{' '}
        <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
          {' '}
          {t('selectComponentHint')}{' '}
        </p>
      </m.div>
    </div>
  );
}
function InspectorHeader({ type, label }: { type: string; label: string }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3.5">
      {' '}
      <p className="truncate font-display text-base font-medium tracking-[-0.015em] text-foreground">{label}</p>{' '}
      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-medium text-primary">
        {' '}
        {type}{' '}
      </span>{' '}
    </div>
  );
}
function InspectorGroupSection({
  group,
  props,
  defaults,
  onUpdate,
}: {
  group: InspectorGroup<Record<string, unknown>>;
  props: Record<string, unknown>;
  defaults: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(group.id !== 'advanced');
  const Icon = group.icon;
  const groupText = useInspectorText();
  const visible = group.fields.filter((field) => !field.showWhen || field.showWhen(props));
  if (visible.length === 0) return null;
  return (
    <div className="border-b border-border/60 last:border-b-0">
      {' '}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sticky top-0 z-10 flex w-full items-center gap-2 bg-card/95 px-3.5 py-2.5 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
      >
        {' '}
        <m.span
          className="inline-flex"
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={spring.snappy}
        >
          <ChevronDown className="size-3.5" />
        </m.span>{' '}
        {Icon && <Icon className="size-3.5" />} {groupText.group(group.titleKey, group.title)}{' '}
      </button>{' '}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        {' '}
        <div className="overflow-hidden">
          {' '}
          {visible.map((field) => (
            <FieldControl
              key={field.key}
              field={field as InspectorFieldDef<Record<string, unknown>>}
              value={props[field.key] ?? defaults[field.key]}
              defaultValue={defaults[field.key]}
              onChange={(value) => void onUpdate(field.key, value)}
            />
          ))}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
function FieldControl({
  field,
  value,
  defaultValue,
  onChange,
}: {
  field: InspectorFieldDef<Record<string, unknown>>;
  value: unknown;
  defaultValue: unknown;
  onChange: (value: unknown) => void;
}) {
  const dirty = value !== defaultValue;
  const reset = () => onChange(defaultValue);
  const fieldText = useInspectorText();
  const control = renderControl(fieldText, field, value, onChange);
  return (
    <FieldRow
      label={field.label}
      labelKey={field.labelKey}
      hint={field.hint}
      hintKey={field.hintKey}
      dirty={dirty}
      onReset={reset}
    >
      {' '}
      {control}{' '}
    </FieldRow>
  );
}
function renderControl(
  fieldText: ReturnType<typeof useInspectorText>,
  field: InspectorFieldDef<Record<string, unknown>>,
  value: unknown,
  onChange: (value: unknown) => void,
): ReactNode {
  switch (field.control) {
    case 'text':
      return (
        <DebouncedTextControl
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={fieldText.placeholder(field.placeholderKey, field.placeholder)}
          multiline={false}
        />
      );
    case 'textarea':
      return (
        <DebouncedTextControl
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={fieldText.placeholder(field.placeholderKey, field.placeholder)}
          multiline
        />
      );
    case 'number':
      return (
        <DebouncedNumberControl
          value={Number(value ?? 0)}
          onChange={onChange}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    case 'select':
      return <SelectControl value={value} onChange={onChange} options={field.options ?? []} />;
    case 'segmented':
      return <SegmentedControl value={value} onChange={onChange} options={field.options ?? []} />;
    case 'slider':
      return (
        <DebouncedSliderControl
          value={Number(value ?? field.min ?? 0)}
          onChange={onChange}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    case 'toggle':
      return <ToggleControl value={Boolean(value)} onChange={onChange} />;
    case 'color':
      return <ColorControl value={String(value ?? '')} onChange={onChange} />;
    case 'icon':
      return <IconControl value={String(value ?? '')} onChange={onChange} />;
    case 'image-upload':
      return <ImageUploadControl value={String(value ?? '')} onChange={(v) => onChange(v)} />;
    case 'repeater':
      return <RepeaterControl field={field} value={value} onChange={onChange} />;
    case 'object':
      return <ObjectControl field={field} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

/**
 * Repeatable array editor. Each item is a normal inspector field group, so
 * nested text, selects, icons and images all use the same controls and reset
 * behaviour as top-level props. Add/remove/reorder keep the array schema-safe.
 */
function RepeaterControl({
  field,
  value,
  onChange,
}: {
  field: InspectorFieldDef<Record<string, unknown>>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const itemFields = field.itemFields ?? [];
  const maxItems = field.maxItems ?? 99;
  const itemLabel = field.itemLabel ?? 'item';
  const updateItem = (index: number, key: string, next: unknown) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)));
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    onChange(next);
  };
  const addItem = () => {
    if (items.length >= maxItems) return;
    onChange([...items, field.newItem?.() ?? {}]);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-surface-sunken/50 px-2.5 py-1.5">
            <span className="truncate text-xs font-medium text-foreground/80">
              {field.getItemSummary?.(item) || `${itemLabel} ${index + 1}`}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title="Move up"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title="Move down"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                title={`Remove ${itemLabel}`}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-90"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {itemFields.map((itemField) => (
              <FieldControl
                key={itemField.key}
                field={itemField}
                value={item[itemField.key]}
                defaultValue={itemField.resetValue}
                onChange={(next) => updateItem(index, itemField.key, next)}
              />
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        disabled={items.length >= maxItems}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-2 py-2.5 text-xs font-medium text-muted-foreground transition active:scale-[0.98] hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Add {itemLabel}
      </button>
    </div>
  );
}

/** Nested object editor for structured props such as CTA objects. */
function ObjectControl({
  field,
  value,
  onChange,
}: {
  field: InspectorFieldDef<Record<string, unknown>>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const object =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const objectFields = field.objectFields ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="divide-y divide-border/60">
        {objectFields.map((objectField) => (
          <FieldControl
            key={objectField.key}
            field={objectField}
            value={object[objectField.key]}
            defaultValue={objectField.resetValue}
            onChange={(next) => onChange({ ...object, [objectField.key]: next })}
          />
        ))}
      </div>
    </div>
  );
} /** * Debounces commits for text-like inputs so typing stays smooth (no store * dispatch per keystroke, stable cursor). Local state drives the input; * the value is committed after a 150ms pause or on blur. External changes * (undo/redo/page switch) are picked up via lastCommitted comparison. */
function useDebouncedValue<T>(value: T, commit: (next: T) => void, delay = 150) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const lastCommitted = useRef(value);
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setLocal(value);
    }
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        commitRef.current(lastCommitted.current);
      }
    },
    [],
  );
  const update = (next: T) => {
    lastCommitted.current = next;
    setLocal(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(next);
    }, delay);
  };
  const flush = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
      commitRef.current(lastCommitted.current);
    }
  };
  return { local, update, flush };
}
function DebouncedTextControl({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: unknown) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { local, update, flush } = useDebouncedValue(value, onChange);
  if (multiline) {
    return (
      <TextareaControl value={local} onChange={update} placeholder={placeholder} onBlur={flush} />
    );
  }
  return <TextControl value={local} onChange={update} placeholder={placeholder} onBlur={flush} />;
}
function DebouncedNumberControl({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: unknown) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { local, update, flush } = useDebouncedValue(value, onChange);
  return (
    <NumberControl value={local} onChange={update} min={min} max={max} step={step} onBlur={flush} />
  );
}
function DebouncedSliderControl({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: unknown) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { local, update, flush } = useDebouncedValue(value, onChange);
  return (
    <SliderControl
      value={local}
      onChange={update}
      min={min}
      max={max}
      step={step}
      onPointerUp={flush}
    />
  );
}

/**
 * Play / Pause / Replay transport for the selected element's entrance.
 *
 * Inspector-only: it drives a temporary playback through the canvas via the
 * animation playback store — it never changes the published page, and it does
 * not enable always-on canvas motion. Hidden unless an entrance is picked.
 */
function AnimationTransport({ nodeId, animType }: { nodeId: string; animType: unknown }) {
  const t = useTranslations('builder');
  const nodeIdActive = useAnimPlayback((s) => s.nodeId === nodeId);
  const mode = useAnimPlayback((s) => (s.nodeId === nodeId ? s.mode : null));
  const play = useAnimPlayback((s) => s.play);
  const replay = useAnimPlayback((s) => s.replay);
  const pause = useAnimPlayback((s) => s.pause);

  if (!animType || animType === 'none' || !nodeId) return null;
  const isPlaying = nodeIdActive && mode === 'play';

  const btn = 'flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground active:scale-95';

  return (
    <div className="border-t border-border/60 px-3.5 py-2.5">
      <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('groups.animationPreview', { default: 'Preview entrance' })}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => play(nodeId)}
          aria-label={t('groups.play', { default: 'Play' })}
          className={btn}
        >
          <Play className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => pause()}
          aria-label={t('groups.pause', { default: 'Pause' })}
          disabled={!isPlaying}
          className={cn(btn, 'disabled:cursor-not-allowed disabled:opacity-40')}
        >
          <Pause className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => replay(nodeId)}
          aria-label={t('groups.replay', { default: 'Replay' })}
          className={btn}
        >
          <RotateCcw className="size-3.5" />
        </button>
        <span className="ms-auto text-2xs text-muted-foreground">
          {isPlaying ? t('groups.playing', { default: 'Playing…' }) : t('groups.held', { default: 'Held' })}
        </span>
      </div>
    </div>
  );
}
